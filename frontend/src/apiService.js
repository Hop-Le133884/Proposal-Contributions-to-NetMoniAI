import axios from "axios";

const API_URL = "http://localhost:8000"; // Match your FastAPI server’s URL

export const getNodeStatuses = async () => {
  try {
    const response = await axios.get(`${API_URL}/gcstatuses`);
    return response.data;
  } catch (error) {
    console.error("Error fetching node statuses:", error);
    throw error;
  }
};
