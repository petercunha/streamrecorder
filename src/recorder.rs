//! All recording logic – token fetch, playlist parsing, segment loop.

use anyhow::Context;
use chrono::{Local, SecondsFormat};
use rand::random;
use reqwest::Client;
use std::{
    collections::HashSet,
    time::{Duration, Instant},
};
use tokio::{
    fs::OpenOptions,
    io::AsyncWriteExt,
    time::{sleep, timeout},
};

/// Public entry-point called from main.rs
pub async fn record(
    url: &str,
    quality: &str,
    output: Option<&str>,
    verbose: u8,
) -> anyhow::Result<()> {
    let channel = extract_channel(url)?;
    let client = Client::builder()
        .user_agent("streamrecorder/0.5")
        .build()?;

    let token = fetch_token(&client, &channel).await?;
    let master = build_master_url(&channel, &token);
    let variants = fetch_variants(&client, &master).await?;
    let chosen = choose_variant(&variants, quality)
        .context("requested quality not found")?;

    let outfile = match output {
        Some(o) => {
            if o.ends_with(".ts") { o.to_string() } else { format!("{}.ts", o) }
        }
        None => default_filename(&channel),
    };

    if verbose > 0 {
        eprintln!(
            "[INFO] Recording '{}' @ {} kbps (\"{}\") → {}",
            channel,
            chosen.bandwidth / 1000,
            chosen.name,
            outfile
        );
    }

    let mut recorder = SegmentRecorder::new(client, &outfile, &chosen.url, verbose).await?;
    recorder.run().await
}

/* --------------------------------------------------------------------- */
/*  Utility helpers                                                      */
/* --------------------------------------------------------------------- */

fn extract_channel(url: &str) -> anyhow::Result<String> {
    Ok(url
        .trim_end_matches('/')
        .split('/')
        .last()
        .context("cannot parse channel from URL")?
        .to_string())
}

fn default_filename(channel: &str) -> String {
    let ts = Local::now()
        .to_rfc3339_opts(SecondsFormat::Secs, false)
        .replace([':', '-'], "");
    format!("{channel}_{ts}.ts")
}

/* ---------------- Token + playlist plumbing -------------------------- */

#[derive(serde::Deserialize)]
struct AccessToken {
    value: String,
    signature: String,
}

#[derive(serde::Deserialize)]
struct GqlResponse {
    data: GqlData,
}

#[derive(serde::Deserialize)]
struct GqlData {
    #[serde(rename = "streamPlaybackAccessToken")]
    token: AccessToken,
}

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

    let res = client
        .post("https://gql.twitch.tv/gql")
        .header("Client-ID", "kimne78kx3ncx6brgo4mv6wki5h1ko")
        .json(&gql)
        .send()
        .await
        .context("token request failed")?
        .text()
        .await?;

    Ok(serde_json::from_str::<GqlResponse>(&res)?.data.token)
}

fn build_master_url(channel: &str, token: &AccessToken) -> String {
    let token_enc = urlencoding::encode(&token.value);
    let sig = &token.signature;
    let rand: u32 = random();
    format!(
        "https://usher.ttvnw.net/api/channel/hls/{channel}.m3u8?sig={sig}&token={token_enc}&allow_source=true&p={rand}"
    )
}

/// A single variant stream (quality name + URL + bandwidth)
struct Variant {
    name: String,
    url: String,
    bandwidth: u64,
}

async fn fetch_variants(client: &Client, master: &str) -> anyhow::Result<Vec<Variant>> {
    let text = client.get(master).send().await?.text().await?;
    let mut variants = Vec::new();
    let mut lines = text.lines();

    while let Some(line) = lines.next() {
        if !line.starts_with("#EXT-X-STREAM-INF:") {
            continue;
        }

        // parse bandwidth
        let bw = line
            .split("BANDWIDTH=")
            .nth(1)
            .and_then(|s| s.split(',').next())
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(0);

        // parse resolution & framerate
        let resolution = line
            .split("RESOLUTION=")
            .nth(1)
            .and_then(|s| s.split(',').next());
        let fps = line
            .split("FRAME-RATE=")
            .nth(1)
            .and_then(|s| s.split(',').next());

        let name = if let (Some(res), Some(fr)) = (resolution, fps) {
            let height = res.split('x').nth(1).unwrap_or("?");
            let fps_int = fr.split('.').next().unwrap_or(fr);
            format!("{}p{}", height, fps_int)
        } else {
            // fallback to simple kbps label
            format!("{}kbps", bw / 1000)
        };

        if let Some(uri) = lines.next() {
            variants.push(Variant {
                name,
                url: uri.to_string(),
                bandwidth: bw,
            });
        }
    }

    Ok(variants)
}

fn choose_variant<'a>(variants: &'a [Variant], quality: &str) -> Option<&'a Variant> {
    if quality.eq_ignore_ascii_case("best") {
        variants.iter().max_by_key(|v| v.bandwidth)
    } else {
        variants
            .iter()
            .find(|v| v.name.eq_ignore_ascii_case(quality))
    }
}

/* ---------------- HLS segment loop ----------------------------------- */

struct SegmentRecorder {
    client: Client,
    output: tokio::fs::File,
    seen: HashSet<String>,
    playlist: String,
    verbose: u8,
}

impl SegmentRecorder {
    async fn new(
        client: Client,
        path: &str,
        playlist: &str,
        verbose: u8,
    ) -> anyhow::Result<Self> {
        let file = OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .open(path)
            .await
            .with_context(|| format!("cannot create '{}'", path))?;

        Ok(Self {
            client,
            output: file,
            seen: HashSet::new(),
            playlist: playlist.to_string(),
            verbose,
        })
    }

    async fn run(&mut self) -> anyhow::Result<()> {
        let mut total_bytes: u64 = 0;
        let start = Instant::now();

        loop {
            let playlist = timeout(
                Duration::from_secs(10),
                self.client.get(&self.playlist).send(),
            )
            .await??
            .text()
            .await?;

            for line in playlist.lines() {
                if line.starts_with('#') || line.is_empty() {
                    continue;
                }
                if self.seen.insert(line.to_string()) {
                    let seg = self.client.get(line).send().await?.bytes().await?;
                    self.output.write_all(&seg).await?;
                    total_bytes += seg.len() as u64;

                    if self.verbose > 0 && total_bytes % 10_000_000 < seg.len() as u64 {
                        let mb = total_bytes as f64 / 1_000_000.0;
                        let secs = start.elapsed().as_secs().max(1);
                        eprintln!(
                            "[INFO] {:.1} MB downloaded | {:.1} MB/s | {} s elapsed",
                            mb,
                            mb / secs as f64,
                            secs
                        );
                    }
                }
            }

            sleep(Duration::from_secs(5)).await;
        }
    }
}
