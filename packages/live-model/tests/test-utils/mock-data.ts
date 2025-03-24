export function mockData(data: Record<string, any>) {
  localStorage.clear();
  for (let [key, value] of Object.entries(data)) {
    localStorage.setItem(key, JSON.stringify(value));
  }
}

export function clearData() {
  localStorage.clear();
}
