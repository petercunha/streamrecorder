# streamrecorder

A lightweight, CPU and memory efficient Twitch HLS recorder written in Rust. Inspired by [Streamlink](https://github.com/streamlink/streamlink), `streamrecorder` fetches a live Twitch HLS stream and writes the raw MPEG‑TS segments into a file.

## Features

- Fetches Twitch GraphQL playback token
- Builds and parses the HLS master playlist
- Selects either the highest‑bandwidth (`best`) or a specific quality (e.g. `720p60`)
- Continuously polls for new segments and appends to an output file

## Installation

```bash
# Clone the repo
git clone https://github.com/petercunha/streamrecorder.git
cd streamrecorder

# Build in release mode
cargo build --release

# Run
./target/release/streamrecorder
```

## Usage

```bash
streamrecorder [OPTIONS] <URL>

Arguments:
  <URL>  Twitch channel URL (e.g. https://www.twitch.tv/forsen)

Options:
  -q, --quality <QUALITY>  Desired stream quality ("best" or a quality preset, e.g. "720p60") [default: best]
  -o, --output <OUTPUT>    Output filename (will append .ts if missing)
  -v, --verbose...         Verbose mode (-v, -vv …)
  -h, --help               Print help
  -V, --version            Print version
```

## License

This project is released under the MIT License. See [LICENSE](LICENSE) for details.
