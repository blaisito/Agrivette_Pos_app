import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/**
 * This file is web-only and used to configure the root HTML for every web page during static rendering.
 * The contents of this function only run in Node.js environments and do not have access to the DOM or browser APIs.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta 
          name="viewport" 
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" 
        />
        
        {/* Prevent auto-zoom on input focus for iOS Safari */}
        <style dangerouslySetInnerHTML={{
          __html: `
            * {
              -webkit-tap-highlight-color: transparent;
              -webkit-touch-callout: none;
            }
            input, textarea, select {
              font-size: 16px !important;
            }
          `
        }} />

        <ScrollViewStyleReset />

        {/* Fonts and other assets can be loaded here */}
      </head>
      <body>{children}</body>
    </html>
  );
}

