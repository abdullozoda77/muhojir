import { lazy } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Layout from "./components/Layout.jsx";
import { useAuth } from "./auth.jsx";
import { useLang } from "./i18n.js";
import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import NotFound from "./pages/NotFound.jsx";

const BlacklistPage = lazy(() => import("./pages/BlacklistPage.jsx"));
const Calculator = lazy(() => import("./pages/Calculator.jsx"));
const Checks = lazy(() => import("./pages/Checks.jsx"));
const Exam = lazy(() => import("./pages/Exam.jsx"));
const Course = lazy(() => import("./pages/Course.jsx"));
const Lesson = lazy(() => import("./pages/Lesson.jsx"));
const CourseExam = lazy(() => import("./pages/CourseExam.jsx"));
const Certificate = lazy(() => import("./pages/Certificate.jsx"));
const SavedJobs = lazy(() => import("./pages/SavedJobs.jsx"));
const Documents = lazy(() => import("./pages/Documents.jsx"));
const EmployerPage = lazy(() => import("./pages/EmployerPage.jsx"));
const Guides = lazy(() => import("./pages/Guides.jsx"));
const Help = lazy(() => import("./pages/Help.jsx"));
const JobDetail = lazy(() => import("./pages/JobDetail.jsx"));
const Jobs = lazy(() => import("./pages/Jobs.jsx"));
const NewsDetail = lazy(() => import("./pages/NewsDetail.jsx"));
const Notifications = lazy(() => import("./pages/Notifications.jsx"));
const Payments = lazy(() => import("./pages/Payments.jsx"));
const Profile = lazy(() => import("./pages/Profile.jsx"));
const Tickets = lazy(() => import("./pages/Tickets.jsx"));
const Places = lazy(() => import("./pages/Places.jsx"));
const Shops = lazy(() => import("./pages/Shops.jsx"));
const ShopPage = lazy(() => import("./pages/ShopPage.jsx"));
const MyShops = lazy(() => import("./pages/MyShops.jsx"));

function Private({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

export default function App() {
  useLang();
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="jobs" element={<Jobs />} />
        <Route path="jobs/:id" element={<JobDetail />} />
        <Route path="employers/:id" element={<EmployerPage />} />
        <Route path="blacklist" element={<BlacklistPage />} />
        <Route path="calculator" element={<Calculator />} />
        <Route path="guides" element={<Guides />} />
        <Route path="news/:id" element={<NewsDetail />} />
        <Route path="help" element={<Help />} />
        <Route path="checks" element={<Checks />} />
        <Route path="exam" element={<Exam />} />
        <Route path="course" element={<Course />} />
        <Route path="course/:level/exam" element={<Private><CourseExam /></Private>} />
        <Route path="course/:level/:number" element={<Lesson />} />
        <Route path="certificates/sample" element={<Certificate sample />} />
        <Route path="certificates/:code" element={<Certificate />} />
        <Route path="tickets" element={<Tickets />} />
        <Route path="places" element={<Places />} />
        <Route path="shops" element={<Shops />} />
        <Route path="shops/:id" element={<ShopPage />} />

        <Route path="documents" element={<Private><Documents /></Private>} />
        <Route path="payments" element={<Private><Payments /></Private>} />
        <Route path="saved-jobs" element={<Private><SavedJobs /></Private>} />
        <Route path="shops/my" element={<Private><MyShops /></Private>} />

        <Route path="notifications" element={<Private><Notifications /></Private>} />
        <Route path="profile" element={<Private><Profile /></Private>} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
