// Project: streamrecorder
// Created Date: 2025-04-21
// Author: Peter Cunha
// Email: petercunha8@gmail.com
// Description: A simple Twitch HLS recorder in Rust. Light and efficient on CPU and memory.
// License: MIT

// Usage: 
//      cargo run -- https://www.twitch.tv/<streamer> best --record lexi.ts
// 
//      streamrecorder https://www.twitch.tv/forsen best --record output.ts

use clap::Parser;
use reqwest::Client;
use serde::Deserialize;
use std::collections::HashSet;
use std::time::Duration;
use tokio::{fs::OpenOptions, io::AsyncWriteExt, time::sleep};
use rand::random;
use anyhow::Context;

/// Simple Twitch HLS recorder in Rust
#[derive(Parser)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// Twitch channel URL
    url: String,
    /// Stream quality (e.g. best, 720p60)
    quality: String,
    /// Output file for recording
    #[arg(long, short)]
    record: String,
}

#[derive(Deserialize)]
struct AccessToken { value: String, signature: String }

// Mirror the GraphQL response
#[derive(Deserialize)]
struct GqlData {
    #[serde(rename = "streamPlaybackAccessToken")]
    token: AccessToken,
}
#[derive(Deserialize)]
struct GqlResponse { data: GqlData }

/// Fetch a Twitch playback access token via GraphQL
async fn fetch_token(client: &Client, channel: &str) -> anyhow::Result<AccessToken> {
    let gql = serde_json::json!({
        "operationName": "PlaybackAccessToken",
        "extensions": { "persistedQuery": {
            "version": 1,
            "sha256Hash": "0828119ded1c13477966434e15800ff57ddacf13ba1911c129dc2200705b0712"
        }},
        "variables": {
            "isLive": true,
            "login": channel,
            "isVod": false,
            "vodID": "",
            "playerType": "embed"
        }
    });

    let resp_text = client
        .post("https://gql.twitch.tv/gql")
        .header("Client-ID", "kimne78kx3ncx6brgo4mv6wki5h1ko")
        .json(&gql)
        .send()
        .await
        .context("failed to send GraphQL request")?
        .text()
        .await
        .context("failed to read GraphQL response")?;

    let resp: GqlResponse = serde_json::from_str(&resp_text)
        .context("failed to parse GraphQL response as GqlResponse")?;
    Ok(resp.data.token)
}

/// Build the M3U8 master playlist URL
fn build_playlist_url(channel: &str, token: &AccessToken) -> String {
    let token_enc = urlencoding::encode(&token.value);
    let sig = &token.signature;
    let rand: u32 = random();
    format!(
        "https://usher.ttvnw.net/api/channel/hls/{channel}.m3u8?sig={sig}&token={token_enc}&allow_source=true&p={rand}",
        channel = channel,
        sig = sig,
        token_enc = token_enc,
        rand = rand
    )
}

/// Represents a variant stream (quality)
struct Variant { name: String, url: String, bandwidth: u64 }

/// Simple line-based parsing of master playlist
async fn fetch_variants(client: &Client, master_url: &str) -> anyhow::Result<Vec<Variant>> {
    let text = client.get(master_url).send().await?.text().await?;
    let mut variants = Vec::new();
    let mut lines = text.lines();
    while let Some(line) = lines.next() {
        if line.starts_with("#EXT-X-STREAM-INF:") {
            let bw = line
                .split("BANDWIDTH=")
                .nth(1)
                .and_then(|s| s.split(',').next())
                .and_then(|s| s.parse::<u64>().ok())
                .unwrap_or(0);
            if let Some(uri) = lines.next() {
                variants.push(Variant {
                    name: bw.to_string(),
                    url: uri.to_string(),
                    bandwidth: bw,
                });
            }
        }
    }
    Ok(variants)
}

/// Choose "best" or exact quality
fn choose_variant<'a>(variants: &'a [Variant], quality: &str) -> Option<&'a Variant> {
    if quality == "best" {
        variants.iter().max_by_key(|v| v.bandwidth)
    } else {
        variants.iter().find(|v| v.name == quality)
    }
}

/// Recorder pulls HLS segments and appends to file
struct Recorder {
    client: Client,
    output: tokio::fs::File,
    seen: HashSet<String>,
    variant_url: String,
}

impl Recorder {
    async fn new(client: Client, record: String, variant_url: String) -> anyhow::Result<Self> {
        let output = OpenOptions::new().create(true).append(true).open(record).await?;
        Ok(Self { client, output, seen: HashSet::new(), variant_url })
    }

    async fn run(&mut self) -> anyhow::Result<()> {
        loop {
            let playlist = self.client.get(&self.variant_url).send().await?.text().await?;
            for line in playlist.lines() {
                if line.starts_with('#') || line.is_empty() { continue; }
                let uri = line.to_string();
                if self.seen.insert(uri.clone()) {
                    let seg = self.client.get(&uri).send().await?.bytes().await?;
                    self.output.write_all(&seg).await?;
                }
            }
            sleep(Duration::from_secs(5)).await;
        }
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let args = Args::parse();
    let channel = args.url.trim_end_matches('/').split('/').last().unwrap().to_string();
    let client = Client::builder().user_agent("streamrecorder/0.1").build()?;
    let token = fetch_token(&client, &channel).await?;
    let master_url = build_playlist_url(&channel, &token);
    let variants = fetch_variants(&client, &master_url).await?;
    let chosen = choose_variant(&variants, &args.quality)
        .ok_or_else(|| anyhow::anyhow!("Requested quality not found"))?;
    let mut recorder = Recorder::new(client, args.record.clone(), chosen.url.clone()).await?;
    recorder.run().await?;
    Ok(())
}
