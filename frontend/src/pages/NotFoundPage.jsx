import { Link } from "react-router-dom";
import { PublicNav } from "../components/layout.jsx";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen">
      <PublicNav />
      <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-24 text-center">
        <p className="text-6xl font-extrabold text-brand-600">404</p>
        <p className="mt-3 text-lg font-semibold text-clinical-ink">This page could not be found</p>
        <Link to="/" className="btn-primary mt-6 px-4 py-2.5">
          Back to home
        </Link>
      </div>
    </div>
  );
}
