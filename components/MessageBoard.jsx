import sdk from "@farcaster/frame-sdk";
import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";

const contractAddress = "0x1DbaA8fC7431218e5E501D70870811893ba0b2A4";
const BASE_CHAIN_ID_HEX = "0x2105"; // 8453
const BASE_CHAIN_ID_DECIMAL = 8453;

const abi = [
  "function postMessage(string calldata _text) external payable",
  "function getMessages() external view returns (tuple(address user, string text, uint256 timestamp)[])"
];

export default function MessageBoard() {
  const [userAddress, setUserAddress] = useState("");
  const [balance, setBalance] = useState("0");
  const [messagesList, setMessagesList] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [text, setText] = useState("");
  const [logs, setLogs] = useState([]);

  const addLog = useCallback((msg) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [`[${time}] ${msg}`, ...prev]);
    console.log(msg);
  }, []);

  useEffect(() => {
    // Initialize Farcaster (mobile)
    const init = async () => {
      try {
        if (sdk && sdk.actions) {
          await sdk.actions.ready();
        }
      } catch (e) { console.error(e); }
    };
    init();
    loadMessages();
  }, []);

  // --- 1. Simple provider selection ---
  const getProvider = () => {
    // If opened in Warpcast
    if (sdk && sdk.wallet && sdk.wallet.ethProvider) {
      return new ethers.BrowserProvider(sdk.wallet.ethProvider);
    }
    // If opened in a regular browser
    if (typeof window !== "undefined" && window.ethereum) {
      return new ethers.BrowserProvider(window.ethereum);
    }
    return null;
  };

  // --- 2. Switch network (only if needed) ---
  const checkNetwork = async (provider) => {
    try {
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== BASE_CHAIN_ID_DECIMAL) {
        addLog("Switching network...");
        await provider.send("wallet_switchEthereumChain", [{ chainId: BASE_CHAIN_ID_HEX }]);
      }
    } catch (error) {
      // If the network is missing, request to add it
      if (error.code === 4902 || error.error?.code === 4902) {
         await provider.send("wallet_addEthereumChain", [{
            chainId: BASE_CHAIN_ID_HEX,
            chainName: 'Base Mainnet',
            rpcUrls: ['https://mainnet.base.org'],
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            blockExplorerUrls: ['https://basescan.org'],
         }]);
      }
    }
  };

  // --- 3. Connect ---
  async function connectWallet() {
    try {
      const provider = getProvider();
      if (!provider) {
        alert("MetaMask not found!");
        return;
      }

      addLog("Connecting...");
      
      // Standard Ethers request
      const accounts = await provider.send("eth_requestAccounts", []);
      if (!accounts[0]) return;

      await checkNetwork(provider);

      setUserAddress(accounts[0]);
      
      const bal = await provider.getBalance(accounts[0]);
      setBalance(ethers.formatEther(bal));
      
      addLog("Connected: " + accounts[0].slice(0,6));
      loadMessages();

    } catch (error) {
      addLog("Error: " + error.message);
      // If a request is already pending, inform the user
      if (error.message.includes("Already processing") || error.code === -32002) {
        alert("Check the MetaMask icon — there is a pending connection request.");
      } else {
        alert("Connection Error: " + error.message);
      }
    }
  }

  // --- 4. Load ---
  async function loadMessages() {
    try {
      const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");
      const contract = new ethers.Contract(contractAddress, abi, provider);
      const rawMessages = await contract.getMessages();
      
      const items = rawMessages.map(msg => ({
        from: msg.user,
        text: msg.text,
        time: new Date(Number(msg.timestamp) * 1000).toLocaleString()
      })).reverse();
      setMessagesList(items);
    } catch (error) { console.error(error); }
  }

  // --- 5. Publish ---
  async function handlePublish() {
    if (!userAddress) {
      await connectWallet();
      return;
    }

    try {
      setIsSending(true);
      const provider = getProvider();
      await checkNetwork(provider); // Check network before sending
      
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, abi, signer);

      // Send (with hang protection)
      const tx = await contract.postMessage(text, { 
        value: ethers.parseEther("0.000001"),
        gasLimit: 500000 
      });
      
      setText("");
      setMessagesList([{from: userAddress, text: text, time: "Pending..."}, ...messagesList]);
      
      // Wait 5 seconds and refresh, even if MetaMask is silent
      addLog("Sent! Waiting for update...");
      await new Promise(r => setTimeout(r, 5000));
      
      setIsSending(false);
      await loadMessages();

    } catch (err) {
      setIsSending(false);
      addLog("Error: " + err.message);
      alert("Error sending: " + err.message);
    }
  }

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto", fontFamily: "Georgia, 'Times New Roman', serif", paddingBottom: "100px", backgroundColor: "#000", color: "#fff" }}>
      <h2 style={{textAlign: "center", color: "#fff"}}>CarnageGM</h2>
      
      <div style={{textAlign: "center", marginBottom: 20}}>
        {!userAddress ? (
          <button 
            onClick={connectWallet} 
            style={{padding: "12px 24px", background: "#D60000", color: "white", border: "none", borderRadius: "10px", fontSize: "16px", cursor: "pointer"}}
          >
             Connect Wallet
          </button>
        ) : (
          <div>
             <div style={{color: "#fff", fontWeight: "bold"}}>Connected: {userAddress.slice(0,6)}...</div>
             <div style={{fontSize: "12px"}}>Balance: {parseFloat(balance).toFixed(4)} ETH</div>
          </div>
        )}
      </div>

      <div style={{marginBottom: "20px"}}>
        <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write message..."
            rows={3}
            style={{width: "100%", padding: 10, marginBottom: 10, border: "1px solid #333", background: "#111", color: "#fff"}}
        />
        <button 
            onClick={handlePublish} 
            disabled={isSending || !text}
            style={{width: "100%", padding: "12px", background: isSending ? "#7A0000" : "#D60000", color: "white", border: "none", cursor: isSending ? "default" : "pointer"}}
        >
            {isSending ? "Publishing..." : "Publish"}
        </button>
      </div>

      <div>
        {messagesList.map((m, i) => (
            <div key={i} style={{borderBottom: "1px solid #222", padding: "10px 0"}}>
                <div style={{fontSize: "16px"}}>{m.text}</div>
                <small style={{color: "#bbb"}}>{m.from.slice(0,6)}... | {m.time}</small>
            </div>
        ))}
      </div>
      
      <div style={{marginTop: 20, fontSize: 10, color: "#bbb", fontFamily: "monospace"}}>
        {logs[0]}
      </div>
    </div>
  );
}
