import { useState, useCallback } from 'react'

// validationRules: { fieldName: (value) => errorString | null }
// Example:
//   const { values, errors, handleChange, handleBlur, validateAll, isValid } = useForm(
//     { name: '', phone: '' },
//     { name: run(validators.required('Name'), validators.minLen(2)), phone: validators.phone }
//   )

export function useForm(initialValues, validationRules = {}) {
  const [values,  setValues]  = useState(initialValues)
  const [errors,  setErrors]  = useState({})
  const [touched, setTouched] = useState({})

  const validate = useCallback((name, value) => {
    const rule = validationRules[name]
    return rule ? rule(value) : null
  }, [validationRules])

  const handleChange = useCallback((name, value) => {
    setValues(v => ({ ...v, [name]: value }))
    if (touched[name]) {
      setErrors(e => ({ ...e, [name]: validate(name, value) }))
    }
  }, [touched, validate])

  const handleBlur = useCallback((name) => {
    setTouched(t => ({ ...t, [name]: true }))
    setErrors(e => ({ ...e, [name]: validate(name, values[name]) }))
  }, [validate, values])

  const validateAll = useCallback(() => {
    const newErrors = {}
    let valid = true
    const newTouched = {}
    Object.keys(validationRules).forEach(name => {
      newTouched[name] = true
      const err = validate(name, values[name])
      if (err) { newErrors[name] = err; valid = false }
    })
    setErrors(newErrors)
    setTouched(newTouched)
    return valid
  }, [validate, validationRules, values])

  const reset = useCallback((newValues = initialValues) => {
    setValues(newValues); setErrors({}); setTouched({})
  }, [initialValues])

  const setFieldError = useCallback((name, error) => {
    setErrors(e => ({ ...e, [name]: error }))
  }, [])

  const isValid = Object.keys(validationRules).every(
    name => !validate(name, values[name])
  )

  return {
    values, errors, touched,
    handleChange, handleBlur, validateAll, reset, setFieldError,
    isValid,
    // Convenience for controlled inputs:
    field: (name) => ({
      value: values[name] ?? '',
      onChange: (e) => handleChange(name, e.target ? e.target.value : e),
      onBlur:   ()  => handleBlur(name),
      error:    touched[name] ? errors[name] : null,
    }),
  }
}
