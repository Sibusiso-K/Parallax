"""Lines whose page text and spoken text differ: the page shows -R29,000, the voice says it in words."""
import asyncio
import json
import subprocess

import edge_tts

OUT = 'C:/Users/USER/Desktop/Parallax-film/audio'
SHE = 'en-ZA-LeahNeural'
LINES = {
    's4': ('In this future, I said yes to the corporate staff-lunch client and bought the second fridge. By month four, late payment left my cash at -R29,000. I wish I had got the payment date in writing before I said yes.',
           'In this future, I said yes to the corporate staff-lunch client, and bought the second fridge. By month four, late payment left my cash at minus twenty-nine thousand rand. I wish I had got the payment date in writing, before I said yes.'),
}


async def make(key, text, spoken):
    mp3 = f'{OUT}/{key}.mp3'
    words = []
    with open(mp3, 'wb') as f:
        async for chunk in edge_tts.Communicate(spoken, SHE, rate='-8%', boundary='WordBoundary').stream():
            if chunk['type'] == 'audio':
                f.write(chunk['data'])
            elif chunk['type'] == 'WordBoundary':
                words.append({'at': chunk['offset'] / 1e7, 'dur': chunk['duration'] / 1e7, 'text': chunk['text']})
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3], capture_output=True, text=True).stdout.strip())
    json.dump({'text': text, 'spoken': spoken, 'voice': SHE, 'duration': dur, 'words': words}, open(f'{OUT}/{key}.json', 'w', encoding='utf-8'), indent=0)
    print(key, round(dur, 2))


async def main():
    for key, (text, spoken) in LINES.items():
        await make(key, text, spoken)


asyncio.run(main())
