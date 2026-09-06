import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Home, Stethoscope } from "lucide-react";
import { TopNav } from "../components/layout.jsx";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen px-3">
      <TopNav />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mx-auto flex max-w-lg flex-col items-center px-4 py-28 text-center"
      >
        <p className="bg-primary-sheen bg-clip-text font-display text-7xl font-extrabold text-transparent">404</p>
        <p className="mt-4 text-lg font-semibold text-fg">This page could not be found</p>
        <p className="mt-1 text-sm text-fg-muted">The link may be broken, or the page may have moved.</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link to="/" className="btn-primary h-11 px-5">
            <Home className="h-4 w-4" /> Back to home
          </Link>
          <Link to="/intake" className="btn-outline h-11 px-5">
            <Stethoscope className="h-4 w-4" /> Start intake
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
