"""Checkpoint-only bounded normal-CLI capture. Raw streams never leave RAM."""
import subprocess,threading
MAX_STDOUT=16*1024*1024
MAX_STDERR=64*1024
def bounded_checkpoint(command,environment,*,cwd,timeout=60):
 if not(0<timeout<=60):raise ValueError('CHECKPOINT_CAPTURE_UNCONFIRMED')
 process=subprocess.Popen(command,cwd=cwd,env=environment,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,shell=False,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
 buffers=[bytearray(),bytearray()];overflow=threading.Event();read_error=threading.Event()
 def stop():
  try:process.kill()
  except OSError:pass
 def read(stream,index,limit):
  try:
   while chunk:=stream.read(4096):
    available=max(0,limit-len(buffers[index]));buffers[index].extend(chunk[:available])
    if len(chunk)>available:overflow.set();stop()
  except Exception:read_error.set();stop()
  finally:stream.close()
 threads=[threading.Thread(target=read,args=(process.stdout,0,MAX_STDOUT),daemon=True),threading.Thread(target=read,args=(process.stderr,1,MAX_STDERR),daemon=True)]
 for thread in threads:thread.start()
 timed_out=False
 try:process.wait(timeout=timeout)
 except subprocess.TimeoutExpired:
  timed_out=True;stop();process.wait(timeout=10)
 for thread in threads:thread.join(timeout=3)
 if any(thread.is_alive()for thread in threads)or read_error.is_set():raise ValueError('CHECKPOINT_CAPTURE_UNCONFIRMED')
 return process.returncode,timed_out,overflow.is_set(),bytes(buffers[0]),bytes(buffers[1])
