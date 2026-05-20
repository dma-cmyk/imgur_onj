import { PopupPage } from './pages/PopupPage';
import { OptionsPage } from './pages/OptionsPage';
import { HistoryPage } from './pages/HistoryPage';

function App() {
  // Use location.href for more robust routing in extensions
  const url = window.location.href;

  if (url.includes('options.html')) {
    return <OptionsPage />;
  }

  if (url.includes('history.html')) {
    return <HistoryPage />;
  }

  return <PopupPage />;
}

export default App;
