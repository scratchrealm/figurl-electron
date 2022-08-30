import { FunctionComponent, useEffect, useMemo, useRef, useState } from 'react';
import QueryParameters from '../electron/preload/src/QueryParameters';
import './App.css';
import FigInterface from './FigInterface';
import urlFromUri from './urlFromUri';
import useWindowDimensions from './useWindowDimensions';

type Props = {
  queryParameters: QueryParameters
}

const App: FunctionComponent<Props> = ({queryParameters}) => {
  const {viewUri} = queryParameters
  if (!viewUri) throw Error('No view uri')
  const [figInterface, setFigInterface] = useState<FigInterface | undefined>(undefined)
  const {width, height} = useWindowDimensions()
  const iframeElement = useRef<HTMLIFrameElement | null>()
  const parentOrigin = window.location.protocol + '//' + window.location.host
  const viewUrlBase = urlFromUri(viewUri)
  const viewUrl = viewUrlBase + '/index.html'
  const figureId = 'test-id'
  useEffect(() => {
    const figInterface = new FigInterface({figureId, iframeElement})
    figInterface.initialize(queryParameters).then(() => {
      setFigInterface(figInterface)
    })
  }, [queryParameters, iframeElement, figureId])
  const src = useMemo(() => {
      let ret = `${viewUrl}?parentOrigin=${parentOrigin}&figureId=${figureId}`
      return ret
  }, [parentOrigin, viewUrl])
  if (!figInterface) {
    return <div>Initializing figure interface</div>
  }
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
