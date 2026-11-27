"""Read only the configured DingTalk MCP endpoints; stdout is for the local bridge."""
import json
import sys
import tomllib
from pathlib import Path
from urllib.parse import urlsplit

try:
    data = tomllib.loads((Path.home() / '.codex' / 'config.toml').read_text())
    servers = {}
    for name in ('dingtalk-sheets', 'dingtalk-docs'):
        item = data.get('mcp_servers', {}).get(name, {})
        url = item.get('url', '')
        target = urlsplit(url)
        if target.scheme != 'https' or target.hostname != 'mcp-gw.dingtalk.com' or item.get('enabled') is False:
            raise ValueError('Missing or unsupported DingTalk MCP configuration')
        servers[name] = {'url': url, 'headers': item.get('http_headers', {})}
    print(json.dumps(servers))
except Exception:
    print('Cannot read configured DingTalk MCP endpoints.', file=sys.stderr)
    sys.exit(1)
