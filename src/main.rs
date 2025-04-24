//! streamrecorder – tiny launcher
//! Author: Peter Cunha
//! License: MIT

mod recorder;

use clap::{ArgAction, Parser};

/// Command-line arguments
#[derive(Parser)]
#[command(
    author,
    version,
    about,
    long_about = None,
    arg_required_else_help = true
)]
struct Args {
    /// Twitch channel URL (e.g. https://www.twitch.tv/forsen)
    url: String,

    /// Desired stream quality ("best" or a bandwidth number, e.g. "3000000")
    #[arg(short, long, default_value = "best")]
    quality: String,

    /// Output filename (will append .ts if missing)
    #[arg(short, long)]
    output: Option<String>,

    /// Verbose mode (-v, -vv …)
    #[arg(short, long, action = ArgAction::Count)]
    verbose: u8,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let Args {
        url,
        quality,
        output,
        verbose,
    } = Args::parse();

    recorder::record(&url, &quality, output.as_deref(), verbose).await
}
