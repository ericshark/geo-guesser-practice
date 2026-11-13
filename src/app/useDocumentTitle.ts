import { useEffect } from 'react';

/** Keeps the browser tab title in step with the current screen. */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = `${title} | GeoGuessr Academy`;
  }, [title]);
}
