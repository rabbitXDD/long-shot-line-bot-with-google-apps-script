import json, os, requests

TOKEN_FILE = os.path.join(os.path.dirname(__file__), 'token.json')
SCRIPT_ID = '1QgOJkAQ8VD9ytHXkR2pF_HxF5zXdu_EVVHjb7mdhgAh1SfVGInucPscM'

def get_token():
    with open(TOKEN_FILE) as f:
        t = json.load(f)
    if t.get('expires_in') and t.get('created'):
        import time
        created = t['created'].replace('Z','+00:00')
    # Use refresh token if needed
    client = json.loads(open('agent_secret_oauth.json').read())['installed']
    token_resp = requests.post(
        'https://oauth2.googleapis.com/token',
        data={
            'client_id': client['client_id'],
            'client_secret': client['client_secret'],
            'refresh_token': t['refresh_token'],
            'grant_type': 'refresh_token',
        }
    ).json()
    token = token_resp['access_token']
    # update token file
    new_token = {**t, 'access_token': token, 'expires_in': token_resp.get('expires_in')}
    with open(TOKEN_FILE, 'w') as f:
        json.dump(new_token, f)
    return token

token = get_token()
h = {'Authorization': f'Bearer {token}'}

# Step 1: Get container binding to find spreadsheet ID
resp = requests.get(
    f'https://script.googleapis.com/v1/projects/{SCRIPT_ID}:read',
    headers=h
)
proj = resp.json()
bindings = proj.get('containerInfo', {}).get('scriptInfo', {}).get('bindings') or \
          proj.get('containerInfo', {}).get('containerType') 
print(json.dumps(proj, indent=2, ensure_ascii=False)[:3000])

# Get container info via a separate endpoint if needed
resp2 = requests.get(
    f'https://script.googleapis.com/v1/projects/{SCRIPT_ID}/containerInfo',
    headers=h
)
print(resp2.status_code)
print(json.dumps(resp2.json(), indent=2, ensure_ascii=False)[:2000])
