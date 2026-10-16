#!/usr/bin/env python3
"""Python 3, standard library only. python sample-bot.py BASE_URL [MATCH_CODE]
Without a code, creates a two-seat match and starts against a built-in bot.
With a code, joins an existing lobby; its host must start the match.
"""
import json
import sys
import time
from urllib.request import Request, urlopen
from urllib.error import HTTPError

base = sys.argv[1].rstrip('/')
def call(path, data=None):
    request = Request(base + path, data=None if data is None else json.dumps(data).encode(),
                      headers={'Content-Type': 'application/json'})
    with urlopen(request, timeout=15) as response:
        return json.load(response)

joining = len(sys.argv) > 2
state = call('/api/matches/' + sys.argv[2].upper() + '/join', {'name': 'Python Skipper'}) if joining else call('/api/matches', {'name': 'Python Skipper', 'seats': 2})
code, token, player = state['code'], state['token'], state['playerId']
print('Match:', code, '| Seat:', player + 1, flush=True)
if not joining:
    state = call('/api/matches/' + code + '/start', {'token': token})

def distance(a, b):
    return abs(a % 5 - b % 5) + abs(a // 5 - b // 5)

def choose(state):
    game = state['game']
    me = game['players'][player]
    beacons = [0, 4, 12, 20, 24]
    targets = beacons if me['cargo'] >= 3 else [i for i, n in enumerate(game['cells']) if n > 0]
    def value(action):
        kind = action['type']
        if kind == 'bank': return me['cargo'] * 3
        if kind == 'harvest': return min(2, 6-me['cargo']) * 3
        if kind == 'raid': return 2
        if kind in ('sail', 'dash'):
            return 3 - min((distance(action['to'], t) for t in targets), default=10) - (1 if kind == 'dash' else 0)
        return -100
    return max(state['legalActions'], key=value)

while True:
    state = call('/api/matches/' + code)
    game = state['game']
    if game['phase'] == 'finished':
        print(json.dumps(state['standings'], indent=2)); break
    if game['phase'] == 'playing' and game['active'] == player:
        try:
            state = call('/api/matches/' + code + '/move', {'token': token, 'revision': state['revision'], 'action': choose(state)})
        except HTTPError as error:
            if error.code != 409: raise
    time.sleep(0.6)
