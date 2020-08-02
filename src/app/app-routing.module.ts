import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import {FrontpageComponent} from './frontpage/frontpage.component';
import {ZettelkastenComponent} from './zettelkasten/zettelkasten.component';

const routes: Routes = [
  { path: '', component: FrontpageComponent },
  { path: 'zks/:userid', component: ZettelkastenComponent },
  { path: 'gd', component: ZettelkastenComponent },
  { path: 'gd/:noteid', component: ZettelkastenComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
