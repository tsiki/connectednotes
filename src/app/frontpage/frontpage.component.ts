import {AfterViewInit, Component, ElementRef, Injector, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {Router} from '@angular/router';
import {GoogleDriveService} from '../backends/google-drive.service';
import {StorageBackend} from '../types';
import {MatDialog} from '@angular/material/dialog';
import {ConfirmationDialogComponent, ConfirmDialogData} from '../confirmation-dialog/confirmation-dialog.component';
import {ANALYTICS_ENABLED_LOCAL_STORAGE_KEY} from '../constants';
import {ReplaySubject} from 'rxjs';

const RADIUS = 8;
const LINE_WIDTH = 15;

@Component({
  selector: 'app-frontpage',
  templateUrl: './frontpage.component.html',
})
export class FrontpageComponent implements OnInit, AfterViewInit, OnDestroy {
  showSpinner = false;

  @ViewChild('canvas') canvas: ElementRef<HTMLCanvasElement>;

  private googleDriveBackend: StorageBackend;
  private readonly onDestroy = new ReplaySubject(1);

  constructor(private router: Router, private injector: Injector, public dialog: MatDialog) {
    this.googleDriveBackend = this.injector.get(GoogleDriveService);
  }

  async ngOnInit() {
    this.showSpinner = true;
    await this.checkIfSignedInAndMaybeRedirect();
    this.showSpinner = false;
  }

  async checkIfSignedInAndMaybeRedirect() {
    const shouldRedirect = await this.googleDriveBackend.shouldUseThisBackend();
    if (shouldRedirect) {
      await this.googleDriveBackend.initialize().then(() =>
          this.router.navigate(['gd'])
      );
    }
  }

  ngAfterViewInit(): void {
    // this.drawLoop();
  }

  drawLoop() {
    const toDraw = Array(25).fill(true);
    const priorities = Array(25).fill(0);
    for (let i = 0; i < 25; i++) {
      priorities[i] = Math.random();
    }

    this.mainDrawLoop(toDraw);

    let idx = -1;
    const drawFn = () => {
      let maxValIdx = -1;
      for (let i = 0; i < 25; i++) {
        if (toDraw[i] && maxValIdx === -1) {
          maxValIdx = i;
        }
        if (priorities[i] > priorities[maxValIdx] && toDraw[i]) {
          maxValIdx = i;
        }
      }
      toDraw[maxValIdx] = false;

      idx++;
      if (idx < toDraw.length) {
        this.mainDrawLoop(toDraw);
      }
    };

    for (let i = 0; i < 25; i++) {
      setTimeout(() => drawFn(), Math.random() * 1000);
    }
  }

  mainDrawLoop(toDraw) {
    const ctx = this.canvas.nativeElement.getContext('2d');
    ctx.strokeStyle = '#000';
    ctx.fillStyle = '#000';
    ctx.font = '94px Arial';
    ctx.fillText('CONNECTED NOTES', 25, 115);
    // ctx.fillText('C', 360, 115);
    // ctx.fillText('D', 555, 115);
    // ctx.fillText('O', 720, 115);
    // ctx.fillText('S', 915, 115);

    ctx.strokeStyle = '#fff';
    ctx.fillStyle = '#fff';
    // ctx.strokeStyle = 'red';
    // ctx.fillStyle = 'red';

    const start1 = 180;
    const fns = [];
    fns.push(...this.drawN(ctx, start1, 50));
    fns.push(...this.drawN(ctx, start1 + 68, 50));
    fns.push(...this.drawE(ctx, start1 + 136, 50, -1));

    const start2 = start1 + 260;
    fns.push(...this.drawT(ctx, start2, 50));
    fns.push(...this.drawE(ctx, start2 + 63, 50, 0));

    const start3 = 660;
    fns.push(...this.drawN(ctx, start3, 50));

    const start4 = 795;
    fns.push(...this.drawT(ctx, start4, 50));
    fns.push(...this.drawE(ctx, start4 + 62, 50, 2));

    for (let i = 0; i < toDraw.length; i++) {
      if (toDraw[i]) {
        fns[i]();
      }
    }
  }


  drawT(ctx: CanvasRenderingContext2D, startX: number, startY: number) {
    const fn1 = () => {
      ctx.beginPath();
      ctx.moveTo(startX - 10, startY);
      ctx.lineTo(startX + 55, startY);
      ctx.lineWidth = LINE_WIDTH;
      ctx.stroke();
    };

    const fn2 = () => {
      ctx.beginPath();
      ctx.moveTo(startX + 22, startY + 6);
      ctx.lineTo(startX + 22, startY + 68);
      ctx.lineWidth = LINE_WIDTH;
      ctx.stroke();
    };

    return [fn1, fn2];
  }

  drawE(ctx: CanvasRenderingContext2D, startX: number, startY: number, additionalOffset: number) {

    const fn1 = () => {
      ctx.beginPath();
      ctx.moveTo(startX, startY - 10);
      ctx.lineTo(startX, startY + 70);
      ctx.lineWidth = LINE_WIDTH;
      ctx.stroke();
    };

    const offset = 3;
    const fn2 = () => {
      ctx.beginPath();
      ctx.moveTo(startX + offset, startY);
      ctx.lineTo(startX + 50, startY);
      ctx.lineWidth = LINE_WIDTH;
      ctx.stroke();
    };

    const fn3 = () => {
      ctx.beginPath();
      ctx.moveTo(startX + offset, startY + 60);
      ctx.lineTo(startX + 50, startY + 60);
      ctx.lineWidth = LINE_WIDTH;
      ctx.stroke();
    };

    const fn4 = () => {
      ctx.beginPath();
      ctx.moveTo(startX + offset + additionalOffset, startY + 30);
      ctx.lineTo(startX + 45, startY + 30);
      ctx.lineWidth = LINE_WIDTH;
      ctx.stroke();
    };

    return [fn1, fn2, fn3, fn4];
  }

  drawN(ctx: CanvasRenderingContext2D, startX: number, startY: number) {

    const fn1 = () => {
      ctx.beginPath();
      ctx.moveTo(startX, startY - 10);
      ctx.lineTo(startX, startY + 70);
      ctx.lineWidth = LINE_WIDTH;
      ctx.stroke();
    };

    const fn2 = () => {
      ctx.beginPath();
      ctx.moveTo(startX - 5, startY - 5);
      ctx.lineTo(startX + 45, startY + 70);
      ctx.lineWidth = LINE_WIDTH;
      ctx.stroke();
    };

    const fn3 = () => {
      ctx.beginPath();
      ctx.moveTo(startX + 40, startY - 10);
      ctx.lineTo(startX + 40, startY + 70);
      ctx.lineWidth = LINE_WIDTH;
      ctx.stroke();
    };

    return [fn1, fn2, fn3];
  }

  async toGd() {
    if (localStorage.getItem(ANALYTICS_ENABLED_LOCAL_STORAGE_KEY) === 'true') {
      this.router.navigate(['gd']);
      return;
    }

    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '600px',
      data: {
        title: 'Analytics usage',
        message: 'Would you like to enable analytics? We use analytics for detecting error states'
         + ' and particularly heavy usage to know which features and bug fixes should be prioritized.'
         + ' Enabling this option sends some anonymous data for us to analyze. Loading analytics might'
         + ' be blocked by adblockers - please consider disabling adblockers on this site if you would like to'
         + ' enable analytics (not like we have ads anyway).',
        confirmButtonText: 'Enable analytics',
        rejectButtonText: 'Disable analytics',
      } as ConfirmDialogData,
    });

    const ans = await dialogRef.afterClosed().toPromise();
    if (ans === undefined) {
      return;
    }
    if (ans) {
      (window as any).gtag('consent', 'default', {
        'ad_storage': 'denied',
        'analytics_storage': 'granted'
      });
    }
    localStorage.setItem(ANALYTICS_ENABLED_LOCAL_STORAGE_KEY, ans.toString());
    this.router.navigate(['gd']);
  }

  ngOnDestroy() {
    this.onDestroy.next(undefined);
  }
}
