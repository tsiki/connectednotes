import {AfterViewInit, Component, ElementRef, HostListener, Injector, OnInit, ViewChild} from '@angular/core';
import {AngularFireAuth} from '@angular/fire/auth';
import { auth } from 'firebase/app';
import 'firebase/auth';
import {Router} from '@angular/router';
import {GoogleDriveService} from '../backends/google-drive.service';
import {EditorComponent} from '../editor/editor.component';

const RADIUS = 8;
const LINE_WIDTH = 15;

@Component({
  selector: 'app-frontpage',
  templateUrl: './frontpage.component.html',
})
export class FrontpageComponent implements AfterViewInit {
  // @ViewChild('canvas') canvas: HTMLCanvasElement;
  @ViewChild('canvas') canvas: ElementRef<HTMLCanvasElement>;

  constructor(private router: Router, private injector: Injector) { }

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
    // Initialize service here - if we initialize immediately after redirecting to new URL the popup is more likely to
    // get blocked
    const service = this.injector.get(GoogleDriveService);
    await service.signInIfNotSignedIn();
    console.log('redirecting');
    this.router.navigate(['gd']);
  }
}
