import {AfterViewInit, Component, ElementRef, HostListener, OnInit, ViewChild} from '@angular/core';
import {AngularFireAuth} from '@angular/fire/auth';
import { auth } from 'firebase/app';
import 'firebase/auth';
import {Router} from '@angular/router';
import {GoogleDriveService} from '../backends/google-drive.service';

@Component({
  selector: 'app-frontpage',
  templateUrl: './frontpage.component.html',
})
export class FrontpageComponent implements AfterViewInit {
  constructor(private router: Router) { }

  ngAfterViewInit(): void {
  }

  toGd() {
    this.router.navigate(['gd']);
  }
}
