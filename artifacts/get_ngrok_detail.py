import urllib.request
import json
import base64

try:
    with urllib.request.urlopen('http://127.0.0.1:4040/api/requests/http?limit=20') as response:
        data = json.loads(response.read().decode())
        for r in data.get('requests', []):
            uri = r.get('request', {}).get('uri', '')
            if 'call_id=8' in uri:
                req_id = r.get('id')
                with urllib.request.urlopen(f'http://127.0.0.1:4040/api/requests/http/{req_id}') as detail_resp:
                    detail = json.loads(detail_resp.read().decode())
                    raw_body = detail.get('request', {}).get('raw', '')
                    raw_bytes = base64.b64decode(raw_body)
                    print('Request Body:')
                    print(raw_bytes.decode('utf-8', errors='ignore'))
except Exception as e:
    print('Error:', e)
