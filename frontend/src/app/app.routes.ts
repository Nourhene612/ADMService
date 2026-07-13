import { Routes } from '@angular/router';
import { AdminDashboardComponent } from './features/admin/admin-dashboard/admin-dashboard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'admin',
    pathMatch: 'full'
  },
  {
    path: 'admin',
    component: AdminDashboardComponent
  }
];