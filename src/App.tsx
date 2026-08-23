import { LanguageProvider } from './context/LanguageContext';
import { CustomerPortal } from './modules/customer/CustomerPortal';
import './index.css';

function App() {
  return (
    <LanguageProvider>
      <CustomerPortal />
    </LanguageProvider>
  );
}

export default App;
