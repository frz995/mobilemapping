export async function fetchWmsLayers(baseUrl) {
  const url = baseUrl.includes('?')
    ? `${baseUrl}&service=WMS&request=GetCapabilities`
    : `${baseUrl}?service=WMS&request=GetCapabilities`;
  const res = await fetch(url);
  const text = await res.text();
  const parser = new DOMParser();
  const xml = parser.parseFromString(text, 'application/xml');
  const layerNodes = Array.from(xml.getElementsByTagName('Layer'));
  const named = layerNodes.filter(n => n.getElementsByTagName('Name').length > 0);
  const out = [];
  const seen = new Set();
  for (const n of named) {
    const name = n.getElementsByTagName('Name')[0].textContent;
    if (seen.has(name)) continue;
    seen.add(name);
    const titleEl = n.getElementsByTagName('Title')[0];
    const title = titleEl ? titleEl.textContent : name;
    out.push({ name, title });
  }
  return out;
}
