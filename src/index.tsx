import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import QueryParameters from '../electron/preload/src/QueryParameters';

const qp = parseQuery(window.location.search)
if (qp.label) document.title = qp.label

const queryParameters: QueryParameters = {
  viewUri: qp.viewUri,
  dataUri: qp.dataUri,
  label: qp.label || 'no-label',
  listenPort: qp.listenPort ? parseInt(qp.listenPort) : undefined
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App queryParameters={queryParameters} />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();


// thanks: https://stackoverflow.com/questions/2090551/parse-query-string-in-javascript
function parseQuery(queryString: string) {
  var query: {[key: string]: string} = {};
  var pairs = (queryString[0] === '?' ? queryString.slice(1) : queryString).split('&');
  for (var i = 0; i < pairs.length; i++) {
      var pair = pairs[i].split('=');
      query[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
  }
  return query;
}