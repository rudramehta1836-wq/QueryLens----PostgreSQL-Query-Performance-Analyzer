import React, { useState, useEffect } from 'react';
import { fetchExamples } from '../api/queryApi';

export default function ExampleQuerySelector({ onSelect }) {
  const [examples, setExamples] = useState([]);
  const [selected, setSelected] = useState('');

  useEffect(() => {
    fetchExamples()
      .then(res => {
        if (res.success) setExamples(res.data);
      })
      .catch(err => console.error('Failed to load examples:', err));
  }, []);

  const handleChange = (e) => {
    const id = e.target.value;
    setSelected(id);
    if (id) {
      const example = examples.find(ex => ex.id === id);
      if (example) onSelect(example.sql);
    }
  };

  return (
    <div className="select-wrapper">
      <select
        id="example-query-selector"
        value={selected}
        onChange={handleChange}
        aria-label="Select an example query"
      >
        <option value="">— Select an example query —</option>
        {examples.map(ex => (
          <option key={ex.id} value={ex.id}>
            {ex.name}
          </option>
        ))}
      </select>
    </div>
  );
}
