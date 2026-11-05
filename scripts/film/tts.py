"""Synthesises the film's lines with en-ZA neural voices, and keeps each word's timing for the lip-sync. Resumable."""
import asyncio
import json
import os
import subprocess
import sys

import edge_tts

OUT = 'C:/Users/USER/Desktop/Parallax-film/audio'
os.makedirs(OUT, exist_ok=True)
SHE, NAR = 'en-ZA-LeahNeural', 'en-ZA-LukeNeural'
LINES = {
    's1': (SHE, 'I said yes to the biggest contract of my life.'),
    's2': (SHE, 'Four months later, I could not pay my staff.'),
    'n1': (NAR, 'She does not exist. Her month four does.'),
    'n2': (NAR, 'Every founder makes this decision blind.'),
    'n3': (NAR, 'Parallax lets you live it first.'),
    'n4': (NAR, 'A caterer tells Parallax about the offer, in her own words.'),
    'n5': (NAR, 'Muse Spark reads it, and shows the exact words behind every number.'),
    'n6': (NAR, 'Then code, not a model, works out three years of cash, for three possible futures.'),
    'n7': (NAR, 'And then, she steps inside.'),
    's3': (SHE, 'I took the contract. I want to understand the gap before the client pays.'),
    'n8': (NAR, 'Muse Image painted this room, and her. SAM cut out every object, so you can touch the photograph.'),
    'n9': (NAR, 'Her mouth moves because Muse Image repainted it, six times. There is no video model.'),
    'n10': (NAR, 'So. What if the client pays late?'),
    'n12': (NAR, 'Now she convenes the board.'),
    'n13': (NAR, 'Muse Wonder dispatches a swarm. Each agent sees only its slice of the decision graph.'),
    'n14': (NAR, 'Cash Forensics searches the engine, and finds the line. This plan survives one month late. Not two.'),
    'n15': (NAR, 'Market Scout goes to the live web. Then code opens the page, to check the number is really there.'),
    'n16': (NAR, 'World Builder chooses the scene. Muse Image repaints the room. And Muse Spark rejects the painting if a single number got in.'),
    'n17': (NAR, 'The agents only propose. Only the founder can change a number.'),
    'n18': (NAR, 'One change. The engine runs again. And the lights come back on.'),
    'n19': (NAR, 'This is not a kitchen demo. One paragraph from a salon owner in Soweto, and her world is built, live.'),
    'n20': (NAR, 'Bring a real contract. Spark reads it, SAM finds the clause, and the engine shows what ninety days would cost.'),
    'n21': (NAR, 'And she leaves with a film of her own future.'),
    'n22': (NAR, 'We attacked our own guard with four hundred and fifty hostile replies. First run, two hundred and nineteen got through. We fixed it. Now, none do. Run it yourself.'),
    'n23': (NAR, 'Every model has a job you can see. All of it built during this hackathon.'),
    's5': (SHE, "I can't tell you what to choose."),
    's6': (SHE, 'I can only show you what it costs.'),
}
RATE = {SHE: '-8%', NAR: '+2%'}


async def make(key, voice, text):
    mp3 = f'{OUT}/{key}.mp3'
    meta = f'{OUT}/{key}.json'
    if os.path.exists(mp3) and os.path.exists(meta):
        old = json.load(open(meta, encoding='utf-8'))
        if old.get('text') == text and old.get('voice') == voice and old.get('rate') == RATE[voice]:
            return
    words = []
    with open(mp3, 'wb') as f:
        talk = edge_tts.Communicate(text, voice, rate=RATE[voice], boundary='WordBoundary')
        async for chunk in talk.stream():
            if chunk['type'] == 'audio':
                f.write(chunk['data'])
            elif chunk['type'] == 'WordBoundary':
                words.append({'at': chunk['offset'] / 1e7, 'dur': chunk['duration'] / 1e7, 'text': chunk['text']})
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3], capture_output=True, text=True).stdout.strip()
    json.dump({'text': text, 'voice': voice, 'rate': RATE[voice], 'duration': float(out), 'words': words}, open(meta, 'w', encoding='utf-8'), indent=0)


async def main():
    extra = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
    lines = dict(LINES)
    for key, (voice, text) in extra.items():
        lines[key] = ({'SHE': SHE, 'NAR': NAR}[voice], text)
    for key, (voice, text) in lines.items():
        await make(key, voice, text)
    total = 0
    for key in lines:
        d = json.load(open(f'{OUT}/{key}.json', encoding='utf-8'))['duration']
        total += d
        print(key, round(d, 2))
    print('total', round(total, 1))


asyncio.run(main())
