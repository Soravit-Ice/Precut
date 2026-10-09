"""Download one FLEURS Thai recording, stopping the archive stream immediately.
Development QA only; this file is never installed with Precut.
"""
import tarfile, subprocess, pathlib, json
root=pathlib.Path('tests/fixtures/generated');root.mkdir(parents=True,exist_ok=True)
url='https://storage.googleapis.com/xtreme_translations/FLEURS102/th_th.tar.gz'
process=subprocess.Popen(['curl','--fail','--silent','--show-error','--location',url],stdout=subprocess.PIPE)
try:
 with tarfile.open(fileobj=process.stdout,mode='r|gz') as tar:
  for member in tar:
   if member.isfile() and member.name.endswith('.wav'):
    (root/'thai.wav').write_bytes(tar.extractfile(member).read())
    (root/'thai-source.json').write_text(json.dumps({'source':url,'member':member.name,'license':'CC-BY-4.0','dataset':'Google FLEURS'},indent=2))
    break
finally:
 process.terminate();process.wait()
