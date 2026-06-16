import api from './axios.js'

export const searchApi = {
  search: (q, types=['leads','projects','tasks']) =>
    api.get('/search', { params: { q, types: types.join(',') } }).then(r => r.data.data),
}
