import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {TitleScreen} from '../src/components/TitleScreen';
import {GameHUDOverlay} from '../src/components/GameHUDOverlay';
import {GarageCustomizer} from '../src/components/GarageCustomizer';
import {PodiumScreen} from '../src/components/PodiumScreen';
const noop = () => {};
const profiles: any[] = ['p1','p2'].map((id,i)=>({id,name:`Vacuum ${i+1}`,isHuman:true,playerIndex:i+1,skin:{primaryColor:'#00ffff',accentColor:'#ffffff',finish:'matte',decal:'plain',topper:'none',underglowColor:'#00ffff'}}));
const states: any[] = profiles.map((p,i)=>({id:p.id,boost:100,coveragePercent:i===0?10:20,dustPoints:i===0?200:0,bumpsGiven:0}));
test('title explains objective, scoring, touch and same-device multiplayer',()=>{
  const html=renderToStaticMarkup(createElement(TitleScreen,{onStartGame:noop,onOpenGarage:noop,isMuted:false,onToggleMute:noop}));
  for(const text of ['90 seconds','10 points','25 points','touch arrows','Solo vs Bots','2 Players · Same Device','Mute Sound']) assert.ok(html.includes(text),text);
});
test('touch HUD exposes both sets of controls and uses total-score leader',()=>{
  globalThis.window = {matchMedia:()=>({matches:true}),innerWidth:390} as any;
  const html=renderToStaticMarkup(createElement(GameHUDOverlay,{gameMode:'splitscreen',profiles,states,timeRemaining:90,coverage:{p1:10,p2:20},dirtRemaining:70,isMuted:false,onToggleMute:noop,onPause:noop,onVirtualInput:noop,pickups:[],dogPos:null,highValueToast:null}));
  for(const player of [1,2]) for(const action of ['Forward','Reverse','Steer Left','Steer Right','Turbo Boost']) assert.ok(html.includes(`aria-label="Player ${player} ${action}"`));
  assert.ok(html.includes('300')); assert.ok(html.includes('01:30')); assert.ok(html.includes('Pause Game'));
  const leader=html.match(/Leader:<\/span><span[^>]*>([^<]*)/); assert.equal(leader?.[1],'Vacuum 1');
});
test('garage exposes editable name and menu return',()=>{
  const html=renderToStaticMarkup(createElement(GarageCustomizer,{profiles,onUpdateProfiles:noop,onBack:noop,onStartMatch:noop,activeRobotId:'p1',setActiveRobotId:noop}));
  assert.ok(html.includes('aria-label="Vacuum Device Name"')); assert.ok(html.includes('Back to Menu')); assert.ok(html.includes('Vacuum 1'));
});
test('results show combined score, rematch, garage and main-menu exits',()=>{
  const stats: any={duration:90,winnerId:'p1',winnerName:'Vacuum 1',totalDirtCleanedPercent:30,leaderboard:profiles.map((p,i)=>({...p,coveragePercent:10,dustPoints:200,bumpsGiven:2,rank:i+1}))};
  const html=renderToStaticMarkup(createElement(PodiumScreen,{stats,onRematch:noop,onOpenGarage:noop,onBackToTitle:noop}));
  for(const text of ['Score','350','Rematch','Main Menu','Customizer Garage'])assert.ok(html.includes(text),text);
});
