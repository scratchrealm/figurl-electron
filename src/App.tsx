import { FunctionComponent, useMemo, useRef } from 'react';
import './App.css';
import FigInterface from './FigInterface';
import urlFromUri from './urlFromUri';
import useWindowDimensions from './useWindowDimensions';

type Props = {
  viewUri: string
  dataUri: string
}

const App: FunctionComponent<Props> = ({viewUri, dataUri}) => {
  const {width, height} = useWindowDimensions()
  const iframeElement = useRef<HTMLIFrameElement | null>()
  const parentOrigin = window.location.protocol + '//' + window.location.host
  const viewUrlBase = urlFromUri(viewUri)
  const viewUrl = viewUrlBase + '/index.html'
  const figureId = 'test-id'
  useMemo(() => (
    new FigInterface({figureId, iframeElement, viewUrl, dataUri: dataUri})
  ), [figureId, viewUrl, dataUri])
  const src = useMemo(() => {
      let ret = `${viewUrl}?parentOrigin=${parentOrigin}&figureId=${figureId}`
      return ret
  }, [parentOrigin, viewUrl])
  return (
    <div style={{position: 'absolute', width, height, overflow: 'hidden'}}>
        <iframe
            ref={e => {iframeElement.current = e}}
            title="figure"
            src={src}
            width={width}
            height={height}
        />
    </div>
  );
}

export default App;
