export async function uploadClips(clips: FileList) {
  const formData = new FormData();
  for (const clip of Array.from(clips)) {
    formData.append('clips', clip);
  }
  const response = await fetch('http://127.0.0.1:8000/upload/', {
    method: 'POST',
    body: formData,
  });
  return response.json();
}

export async function clearClips(){
    const response = await fetch('http://127.0.0.1:8000/clear/', {
    method: 'DELETE',
  });
  return response.json();
}
