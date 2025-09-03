export async function getJSON(path) {
  try {
    const res = await fetch(path, { headers: { "Cache-Control": "no-cache" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    throw new Error(`Error al cargar ${path}: ${err.message}`);
  }
} 