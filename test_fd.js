const buffer = Buffer.from('test');
const blob = new Blob([buffer], { type: 'video/mp4' });
const fd = new FormData();
fd.append('test', blob, 'test.mp4');
console.log(fd.get('test'));
