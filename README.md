# streamlink_rs

A lightweight, CPU‑ and memory‑efficient Twitch HLS recorder written in Rust. Inspired by [Streamlink](https://github.com/streamlink/streamlink), `streamlink_rs` fetches a live Twitch HLS stream and writes the raw MPEG‑TS segments into a file.

## Features

- Fetches Twitch GraphQL playback token
- Builds and parses the HLS master playlist
- Selects either the highest‑bandwidth (`best`) or a specific quality (e.g. `720p60`)
- Continuously polls for new segments and appends to an output file
- Zero‑dependency parsing (line‑based) for maximum performance

## Installation

```bash
# Clone the repo
git clone https://github.com/petercunha/streamlink_rs.git
cd streamlink_rs

# Build in release mode
cargo build --release

# Install (optional)
cp target/release/streamlink_rs /usr/local/bin/
```

## Usage

```bash
# Record the best quality from a live channel
streamlink_rs https://www.twitch.tv/some_channel best --record output.ts
```

## License

This project is released under the MIT License. See [LICENSE](LICENSE) for details.
