import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', title: 'TestClub', loadComponent: () => import('./pages/home/home').then((m) => m.Home) },
  { path: 'dashboard', title: 'Dashboard · TestClub', loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.Dashboard) },
  { path: 'courses', title: 'My courses · TestClub', loadComponent: () => import('./pages/courses/courses').then((m) => m.Courses) },
  {
    path: 'courses/:slug',
    loadComponent: () => import('./pages/course/course-shell').then((m) => m.CourseShell),
    children: [
      { path: '', loadComponent: () => import('./pages/course/overview/overview').then((m) => m.Overview) },
      { path: 'guide', loadComponent: () => import('./pages/course/exam-guide/exam-guide').then((m) => m.ExamGuidePage) },
      { path: 'lectures/:n', loadComponent: () => import('./pages/course/lecture/lecture').then((m) => m.LecturePage) },
      { path: 'practice', loadComponent: () => import('./pages/course/practice/practice').then((m) => m.Practice) },
      { path: 'mock', loadComponent: () => import('./pages/course/mock/mock').then((m) => m.Mock) },
      { path: 'mistakes', loadComponent: () => import('./pages/course/mistakes/mistakes').then((m) => m.Mistakes) },
      { path: 'progress', loadComponent: () => import('./pages/course/progress/progress').then((m) => m.ProgressPage) },
    ],
  },
  { path: 'search', title: 'Search · TestClub', loadComponent: () => import('./pages/search/search').then((m) => m.SearchPage) },
  { path: 'guide', title: 'Guide · TestClub', loadComponent: () => import('./pages/guide/guide').then((m) => m.Guide) },
  { path: '**', title: 'Page not found · TestClub', loadComponent: () => import('./pages/not-found/not-found').then((m) => m.NotFound) },
];
