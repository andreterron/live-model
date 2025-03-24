import { useData } from 'live-model';

export function App() {
  const { value } = useData('live-model', 1);
  return <div>Live Model {value}</div>;
}

export default App;
