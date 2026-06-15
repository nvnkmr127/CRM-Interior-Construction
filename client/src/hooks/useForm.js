import { useState } from 'react';

export function useForm(initialValues, validationRules) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const validate = (fieldName, value) => {
    const rules = validationRules[fieldName] || [];
    for (const rule of rules) {
      const error = rule(value);
      if (error) return error;
    }
    return null;
  };

  const handleChange = (name, value) => {
    setValues(v => ({ ...v, [name]: value }));
    if (touched[name]) {
      const error = validate(name, value);
      setErrors(e => ({ ...e, [name]: error }));
    }
  };

  const handleBlur = (name) => {
    setTouched(t => ({ ...t, [name]: true }));
    const error = validate(name, values[name]);
    setErrors(e => ({ ...e, [name]: error }));
  };

  const validateAll = () => {
    const newErrors = {};
    let hasErrors = false;
    Object.keys(validationRules).forEach(name => {
      const error = validate(name, values[name]);
      if (error) { newErrors[name] = error; hasErrors = true; }
    });
    setErrors(newErrors);
    setTouched(Object.keys(validationRules).reduce((a,k) => ({...a,[k]:true}), {}));
    return !hasErrors;
  };

  const isValid = Object.keys(validationRules).every(k => !validate(k, values[k]));
  
  return { values, errors, touched, handleChange, handleBlur, validateAll, isValid, setValues };
}
