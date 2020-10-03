import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ExploreAndStudyComponent } from './explore-and-study.component';

describe('ExploreAndStudyComponent', () => {
  let component: ExploreAndStudyComponent;
  let fixture: ComponentFixture<ExploreAndStudyComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ExploreAndStudyComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ExploreAndStudyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
