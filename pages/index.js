import Head from 'next/head';
import { useEffect } from 'react';
import sdk from '@farcaster/frame-sdk';
import MessageBoard from "../components/MessageBoard";

export default function Home() {
  
  // 1. Notify Farcaster that the app is ready
  useEffect(() => {
    const load = async () => {
      await sdk.actions.ready();
    };
    if (sdk && sdk.actions) {
      load();
    }
  }, []);

  // 2. Launch button settings
  const appUrl = 'https://carnage-gm.vercel.app/';
  
  const frameMetadata = JSON.stringify({
    version: "next",
    imageUrl: `${appUrl}/icon.png`,
    button: {
      title: "Launch App",
      action: {
        type: "launch_frame",
        name: "CarnageGM",
        url: appUrl,
        splashImageUrl: `${appUrl}/icon.png`,
        splashBackgroundColor: "#ffffff"
      }
    }
  });

  return (
    <>
      <Head>
        <title>CarnageGM</title>
        <meta name="description" content="Decentralized message board on Base Network" />
        
        {/* This line is added for verification */}
        <meta name="base:app_id" content="697b40fd7a620235c741a8ce" />
        
        <meta name="fc:frame" content={frameMetadata} />
        <meta property="og:title" content="CarnageGM" />
        <meta property="og:image" content={`${appUrl}/icon.png`} />
      </Head>

      <style jsx global>{`
        body {
          background: #000;
          color: #fff;
        }
      `}</style>

      <MessageBoard />
    </>
  );
}
