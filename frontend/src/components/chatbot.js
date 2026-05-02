// chatbot.js
import React, { useState, useEffect, useRef } from "react";
import "../chatbot.css";

const Chatbot = ({ chatMessages, addChatMessage, sendChatMessage }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const chatHistoryRef = useRef(null);

  // Opens or closes the chatbot when you click the button
  const toggleChatbot = () => setIsOpen(!isOpen);

  // Sends your message when you click "Send" or press Enter
  const handleSend = () => {
    if (input.trim()) {
      // Only send if you typed something
      const userMessage = { sender: "user", text: input };
      addChatMessage(userMessage); // Adds your message to the chat
      sendChatMessage(input); // Pretends to send it (we’ll log it for now)
      setInput(""); // Clears the text box
    }
  };

  // Listens for the Enter key to send the message
  const handleKeyPress = (e) => {
    if (e.key === "Enter") handleSend();
  };

  // Makes the chat scroll down to show the latest message
  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [chatMessages]);

  return (
    <div className={`chatbot ${isOpen ? "open" : ""}`}>
      <button className="chatbot-toggle" onClick={toggleChatbot}>
        {isOpen ? "Close" : "Chat"}
      </button>
      {isOpen && (
        <div className="chatbot-window">
          <div className="chat-history" ref={chatHistoryRef}>
            {chatMessages.map((msg, index) => (
              <div key={index} className={`message ${msg.sender}`}>
                {msg.text}
              </div>
            ))}
          </div>
          <div className="chat-input">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
            />
            <button onClick={handleSend}>Send</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chatbot;
