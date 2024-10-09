import React from 'react';
import { useFocusable } from '@noriginmedia/norigin-spatial-navigation';

function App() {
  const { ref, focused } = useFocusable();
  return (
    <div ref={ref} style={{ border: focused ? '2px solid blue' : 'none' }}>
      <h1>Norigin Spatial Navigation Demo</h1>
      <p>This element is focusable!</p>
    </div>
  );
}

export default App;