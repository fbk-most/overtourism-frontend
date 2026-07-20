import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatbotIntegratedComponent } from './chatbot-integrated.component';


describe('ChatbotComponent', () => {
  let component: ChatbotIntegratedComponent;
  let fixture: ComponentFixture<ChatbotIntegratedComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ChatbotIntegratedComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChatbotIntegratedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
