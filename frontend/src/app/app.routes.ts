import { Routes } from '@angular/router';
import { AdminDashboardComponent } from './features/admin/admin-dashboard/admin-dashboard';
import { AssessmentWizardComponent } from './features/user/assessment-wizard/assessment-wizard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'admin',
    pathMatch: 'full',
  },
  {
    path: 'admin',
    component: AdminDashboardComponent,
  },
  {
    path: 'user',
    component: AssessmentWizardComponent,
    canDeactivate: [
      (component: AssessmentWizardComponent) =>
        component.canDeactivate ? component.canDeactivate() : true,
    ],
  },
];

