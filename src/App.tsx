import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import Editor from "@/pages/Editor";
import Present from "@/pages/Present";
import AudienceHome from "@/pages/AudienceHome";
import AudienceRoom from "@/pages/AudienceRoom";
import Report from "@/pages/Report";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/editor/:presentationId" element={<Editor />} />
        <Route path="/editor/new" element={<Editor />} />
        <Route path="/present/:presentationId" element={<Present />} />
        <Route path="/audience" element={<AudienceHome />} />
        <Route path="/audience/:code" element={<AudienceRoom />} />
        <Route path="/report/:presentationId/:sessionId" element={<Report />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </Router>
  );
}
