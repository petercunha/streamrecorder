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
    arg_required_else_help = true   // show help if no URL provided
)]
struct Args {
    /// Twitch channel URL (e.g. https://www.twitch.tv/forsen)
    url: String,

    /// Verbose mode (-v, -vv … for extra chatter)
    #[arg(short, long, action = ArgAction::Count)]
    verbose: u8,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let Args { url, verbose } = Args::parse();
    recorder::record(&url, verbose).await
}
