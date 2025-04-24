  const DEPLOYED_MASS                      = 10000
  const FACTORY_TIME_MAKE_MINING           = 3000
  const FACTORY_TIME_MAKE_DRONE_DEPLOYMENT = 4000
  const FACTORY_TIME_MAKE_TURRET           = 3500
  const TURRET_RADIUS                      = 228
  const TURRET_MAX_AMMO                    = 2000
  const TURRET_FIRE_INTERVAL               = 250
  const TURRET_FIRE_DAMAGE                 = 2
  const TURRET_BEAM_PROJECTILE_SPEED       = 800
  const ENEMY_SCOUT_RADIUS                 = 200
  const ENEMY_SCOUT_FIRE_DAMAGE            = 2
  const ENEMY_SCOUT_FIRE_INTERVAL          = 350
  const MINING_UNIT_CAPACITY               = 400
  const SOLAR_POWER_SENDING_RADIUS         = 128
  const ENEMY_SCOUT_BEAM_PROJECTILE_SPEED  = 800

  kaplay({
    scale: 2,
    font: 'monospace',
    background: [ 143, 193, 181, ],
  });

  var selected = null
  var duration = 0.1
  var dialog   = loadDialog();
  
  loadSprites()
    
  add( [ sprite('bck', { width: width(), height: height() } ) ] )

  scene(
    "gameover",
    () => {
      setBackground(33, 0, 0 );
      add(
        [
          text("Your base has been destroyed.", { size: 12, font: 'sans-serif', width: 180 } ),
          pos(center().sub(vec2(90,0)))
        ]
      );
      onMousePress(() => { location.reload(); });
    }
  );


  var doTween = (obj, toLocation) => {
    if (obj.curTween) obj.curTween.cancel();

    // rotate to point
    obj.angle = obj.pos.angle(toLocation) + 270

    obj.curTween = tween(
      obj.pos,
      toLocation,
      duration * obj.pos.dist(toLocation),
      (val) => {
        obj.pos = val
      },
      easings.easeInOutSine
    )
    .then(
      () => {
        switch (obj.tags[0]) {
          case 'mobileMiningUnit':
            obj.state = 'nextWaypoint'
            break;
          
          case 'enemyScout':
            obj.state = 'endOfMove'
            break;
        
          default:
            obj.status = 'ready'
            obj.play('ready');
            break;
        }
      }
    )    
  };

  var doChange = (obj, status) => {
    self.setTimeout(
      () => {
        obj.status = `${status}`
        obj.stop()
        obj.play(`${status}`);
      },
      33
    )  
  };

  var removeFromDeployment = (obj) => {
    if (obj.tags[0] == 'mobileFactory') {
      go("gameover")
      return;
    }
    var idx = deployment.findIndex(i => i.identity == obj.identity)
    if (idx > 0) deployment.splice(idx, 1);
  }

  var updateDynamicOnEvents = () => {
    for (let i = 0; i < deployment.length; i++) {
      var unit = deployment[i]
      if (unit.isFriendly) {
        onClick(
          unit.tags[0], 
          (obj) => { 
            selected = obj; 
          }
        );

        onCollide(
          'enemyScoutBlast', 
          unit.tags[0],
          (projectile, recipient, collision) => { 
            if (recipient.energyHP < ENEMY_SCOUT_FIRE_DAMAGE) {
              removeFromDeployment(recipient)
            }
            recipient.energyHP -= ENEMY_SCOUT_FIRE_DAMAGE;  
            if ( recipient.energyHP < 0) {
              removeFromDeployment(recipient)
              destroy(recipient)
            }
            destroy(projectile)
          }
        );
      }
      else {

        onCollide(
          'turretBlast', 
          unit.tags[0],
          (projectile, recipient, collision) => { 
            
            destroy(projectile)

            if (recipient.energyHP < TURRET_FIRE_DAMAGE) {
              removeFromDeployment(recipient)
            }
            recipient.energyHP -= TURRET_FIRE_DAMAGE;  
            if ( recipient.energyHP < 0) {
              removeFromDeployment(recipient)
              if (selected && selected.identity == recipient.identity) selected = null
              destroy(recipient)
            }
            if (selected && selected.identity == recipient.identity) selected = null
          }
        );
        
      }
    }
  };

  var drawMenu = (text, pos, backColor) => {
    var formattedText = formatText(
      {
        text,
        size: 9,
        pos: pos.add(4),
        color: rgb(255, 255, 255),
        fixed: true,
      }
    )
    drawRect({
      width: formattedText.width + 16,
      height: formattedText.height + 16,
      pos,
      color: backColor,
      radius: 4,
      opacity: 0.8,
      fixed: true,
      z: 1000
    });

    drawFormattedText(formattedText);
  };
    
  var moveNow = (obj) => {
    // pack up
    switch (obj.status) {
      case 'deployed':
      case 'deploy':
        obj.status = 'bundle'
        obj.play(
          'bundle',
          {
            onEnd: () => {
              doChange(obj, 'moving')
              doTween(obj, mousePos())
            } 
          }
        );
        break;
  
      case 'bundle':
        self.setTimeout(
          () => {
            doChange(obj, 'moving')
          },
          33
        )
        doTween(obj, mousePos())
        break;
  
      case 'ready':
      case 'moving':
        doChange(obj, 'moving')
        doTween(obj, mousePos())
        break;
    }  
  };

  var deploy = (obj) => {
    if(obj.status == 'ready') {
      obj.status = 'deploy'
      obj.play(
        'deploy',
        {
          onEnd: () => {
            doChange(obj, 'deployed')
            obj.mass = DEPLOYED_MASS
            if (obj.postDeployFunc) obj.postDeployFunc()
          }
        }
      );
    }
  };

  var packUp = (obj) => {
    if(obj.status == 'deployed' ||  obj.tags[0] == 'turret') {
      obj.status = 'bundle'
      obj.play(
        'bundle',
        {
          onEnd: () => {
            doChange(obj, 'ready')
            obj.mass = 10
            if (obj.postPackupFunc) obj.postPackupFunc()
          } 
        }
      );  
    }
  };

  var getMenuFunc = (obj) => {
    switch (obj.tags[0]) {
      case 'mobileFactory':
        return () => {
          var txt = `[G] Go to...`
          if (obj.status == 'deployed') {
            if (obj.isBusy) txt = `Busy building ${obj.making}...` 
            else            txt = `[P] Pack-up\n\n[R] Drone Deploymnet Launch Vehicle\n[M] Make Mining Unit\n[T] Make Turret\n[H] Get Repair\n`
          }
          if(obj.status == 'ready')    txt = `[D] Deploy \n[G] Go to...`
          
          var stats = `Factory.          Ore: ${obj.oreLevel}, Crew: ${obj.numberOfCrew}`
          drawMenu(`${stats}\n\n` + txt, obj.pos.add(24, -22), rgb(56, 71, 0))
        };
        break;

      case 'mobileCommand':
        return () => {
          var txt = `[G] Go to...`
          if(obj.status == 'deployed') txt = `[P] Pack-up\n[H] Get Repair\n`
          if(obj.status == 'ready')    txt = `[G] Go to...`
          drawMenu(`Mobile Command\n\n` + txt, obj.pos.add(24, -22), rgb(56, 18, 42))
        };
        break;

      case 'mobileMiningUnit':
        return () => {
          var txt = ``
          if(obj.status == 'ready') txt = `[G] Go to...\n[H] Get Repair\n`
          drawMenu(`Miner\n\n` + txt, obj.pos.add(24, -22), obj.menuColor)
        };
        break;

      case 'turret':
        return () => {
          var txt = `[G] Go to...`
          if(obj.status != 'ready' && obj.status != 'moving') txt = `[P] Pack-up\n[H] Get Repair\n[A] Get Ammo\n`
          if(obj.status == 'ready') txt = `[D] Deploy \n[G] Go to...`
          drawMenu(`Turret\n\n` + txt, obj.pos.add(24, -22), obj.menuColor)
        };
        break;

      case 'solarPanel':
        return () => {
          var txt = `[G] Go to...`
          if(obj.status == 'deployed') txt = `[P] Pack-up\n[H] Get Repair\n`
          if(obj.status == 'ready')    txt = `[D] Deploy \n[G] Go to...`
          drawMenu(`Solar Panel\n\n` + txt, obj.pos.add(24, -22), rgb(128, 71, 71))
        };
        break;        
    
      case 'droneDeployment':
        return () => {
          var txt = `[G] Go to...`
          if(obj.status == 'deployed') txt = `[P] Pack-up`
          if(obj.status == 'ready')    txt = `[D] Deploy \n[G] Go to...`
          drawMenu(`Drone Deployment\n\n` + txt, obj.pos.add(24, -22), rgb(128, 71, 71))
        };
        break;

      default:
        return () => {};
        break;
    }
  };

  var getMenuCommandFunc = (obj) => {
    switch (obj.tags[0]) {
      case 'mobileFactory':
        return (key) => {
          switch (`${key}`.toUpperCase()) {
            case "D":   //deploy
              deploy(obj)
              break;
            case "P":
              packUp(obj)
              break;
            case "G":
              obj.isMoving = true
              break;
            case "H":
              if (obj.numberOfCrew < 1) { debug.log(pickOne(dialog.MESSAGES_NO_CREW)); return; };
              if (hasDroneDelivery()) {
                var from = getClosestDroneDeployer(obj);
                dispatchDrone(from, obj, 'H')
              }
              break;
            case "M":
              if (obj.numberOfCrew < 1) { debug.log(pickOne(dialog.MESSAGES_NO_CREW)); return; };
              if ( hasPower(obj) ) {
                obj.making = 'Mining Unit';
                obj.isBusy = true;
                self.setTimeout(
                  () => {
                    addMiningUnitAt(obj.pos.add(32));
                    obj.numberOfCrew--;
                    obj.isBusy = false;
                  }, 
                  FACTORY_TIME_MAKE_MINING
                );
              }
              else debug.log(pickOne(dialog.MESSAGES_NO_POWER));
              break;
            case "R":
              if (obj.numberOfCrew < 1) { debug.log(pickOne(dialog.MESSAGES_NO_CREW)); return; };
              if ( hasPower(obj) ) {
                obj.making = 'Drone Deployment';
                obj.isBusy = true;
                self.setTimeout(
                  () => {
                    addDroneDeploymentAt(obj.pos.add(32));
                    obj.numberOfCrew--;
                    obj.isBusy = false;
                  }, 
                  FACTORY_TIME_MAKE_DRONE_DEPLOYMENT
                );
              }
              else debug.log(pickOne(dialog.MESSAGES_NO_POWER));
              break;
            case "T":
              if (obj.numberOfCrew < 1) { debug.log(pickOne(dialog.MESSAGES_NO_CREW)); return; };
              if ( hasPower(obj) ) {
                obj.making = 'Turret';
                obj.isBusy = true;
                self.setTimeout(
                  () => {
                    addTurretAt(obj.pos.add(32));
                    obj.numberOfCrew--;
                    obj.isBusy = false;
                  }, 
                  FACTORY_TIME_MAKE_TURRET
                );                
              }
              else debug.log(pickOne(dialog.MESSAGES_NO_POWER));
              break;
          }
        };
        break;

      case 'mobileCommand':
        return (key) => {
          switch (`${key}`.toUpperCase()) {
            case "G":
              obj.isMoving = true
              break;
              
            case "H":
              if (hasDroneDelivery()) {
                var from = getClosestDroneDeployer(obj);
                dispatchDrone(from, obj, 'H')
              }
              break;
          }
        };
        break;       

      case 'mobileMiningUnit':
        return (key) => {
          switch (`${key}`.toUpperCase()) {
            case "G":
              obj.isMoving = true
              obj.state    = 'directed'
              break;

            case "H":
              if (hasDroneDelivery()) {
                var from = getClosestDroneDeployer(obj);
                dispatchDrone(from, obj, 'H')
              }
              break;
          }
        };
        break;

      case 'turret':
        return (key) => {
          switch (`${key}`.toUpperCase()) {
            case "D":   //deploy
              deploy(obj)
              break;

            case "P":
              packUp(obj)
              break;

            case "H":
              if (hasDroneDelivery()) {
                var from = getClosestDroneDeployer(obj);
                dispatchDrone(from, obj, 'H')
              }
              break;

            case "A":
              if (hasDroneDelivery()) {
                var from = getClosestDroneDeployer(obj);
                dispatchDrone(from, obj, 'A')
              }
              break;

            case "G":
              obj.isMoving = true
              break;
          }
        };
        break;    

      case 'solarPanel':
        return (key) => {
          switch (`${key}`.toUpperCase()) {
            case "D":   //deploy
              deploy(obj)
              break;

            case "P":
              packUp(obj)
              break;

            case "H":
              if (hasDroneDelivery()) {
                var from = getClosestDroneDeployer(obj);
                dispatchDrone(from, obj, 'H')
              }
              break;

            case "G":
              obj.isMoving = true
              break;
          }
        };
        break;
      
      case 'droneDeployment':
        return (key) => {
          switch (`${key}`.toUpperCase()) {
            case "D":   //deploy
              deploy(obj)
              break;
            case "P":
              packUp(obj)
              break;
            case "G":
              obj.isMoving = true
              break;
          }
        };
        break;

      default:
        return (key) => {};
        break;
    }
  };

  var getMiningUnitAI = (obj) => {
    return () => {
      if (!obj.state) obj.state = ''
      switch (obj.state) {
        case 'mining':
          if (obj.status != 'collect') {
            obj.status = 'collect'
            obj.play(
              'collect',
              {
                onEnd: () => {
                  doChange(obj, 'ready')
                  obj.oreLevel += parseInt(rand(0, 64))
                  if (obj.oreLevel >= MINING_UNIT_CAPACITY) {
                    var bez  = getEieoBezier(obj.pos, mobileFactory.pos)
                    
                    obj.waypoints = []
                    
                    for (let t = 0.001; t < 0.999; t += 0.06) {
                      obj.waypoints.push(evaluateBezier(bez.pt1, bez.pt2, bez.pt3, bez.pt4, t));
                    }
                    
                    obj.state = 'nextWaypoint'                    
                  }
                  else obj.state = '';
                } 
              }
            );
          };
          break;

        case 'nextWaypoint':
          //move to waypoint
          if (obj.waypoints.length > 0) {
            var waypoint = obj.waypoints.shift()
            doTween(obj, waypoint)
            obj.state = 'waitForTween'
          }
          else {
            // get new waypoints
            if (obj.pos.dist(mobileFactory.pos) < 64) {
              mobileFactory.oreLevel += obj.oreLevel
              obj.oreLevel = 0
            }
            obj.state = 'mining'
          }       
          break;

        case 'waitForTween':
          // wait for tween
          break;
      
        default:
          // find ore
          // if no ore, set rand waypoint
          var pos1 = obj.pos
          var pos2 = vec2(rand(0,width()), rand(0,height()))

          var bez  = getEieoBezier(pos1, pos2)
          
          obj.waypoints = []
          
          for (let t = 0.001; t < 0.999; t += 0.06) {
            obj.waypoints.push(evaluateBezier(bez.pt1, bez.pt2, bez.pt3, bez.pt4, t));
          }
          
          obj.state = 'nextWaypoint'
          break;
      }      
    }
  };

  var addMiningUnitAt = (location) => {
    const mobileMiningUnit = add([
      sprite('mmu'),
      pos(location),
      anchor('center'),
      area( { collisionIgnore: ['mobileFactory'] } ),
      body(),
      "mobileMiningUnit"
    ]);
    mobileMiningUnit.menuCommand = getMenuCommandFunc(mobileMiningUnit)
    mobileMiningUnit.spriteObj   = getSprite(mobileMiningUnit.sprite)
    mobileMiningUnit.menu        = getMenuFunc(mobileMiningUnit)
    mobileMiningUnit.ai          = getMiningUnitAI(mobileMiningUnit)
    mobileMiningUnit.menuColor   = rgb(rand(64, 128), rand(64, 128), rand(0, 64))
    mobileMiningUnit.isMoving    = false
    mobileMiningUnit.isFriendly  = true
    mobileMiningUnit.status      = 'ready'
    mobileMiningUnit.curTween    = null
    mobileMiningUnit.energyHP    = 100
    mobileMiningUnit.oreLevel    = 0
    mobileMiningUnit.identity    = randomUUID()
    mobileMiningUnit.onCollide('mobileCommand',    (obj) => { mobileMiningUnit.energyHP -= 0.1 })
    mobileMiningUnit.onCollide('turret',           (obj) => { mobileMiningUnit.energyHP -= (obj.status == 'deployed' ? 0.4 : 0.1) })
    mobileMiningUnit.onCollide('mobileMiningUnit', (obj) => { mobileMiningUnit.energyHP -= 0.07 })
    deployment.push(mobileMiningUnit)
    setTimeout(() => { updateDynamicOnEvents() }, 33);
  };

  var getTurretAI = (obj) => {
    return () => {
      if (!obj.state) obj.state = ''
      switch (obj.state) {
        case 'scanEnemy':
          for (let i = 0; i < deployment.length; i++) {
            const scanTarget = deployment[i];
            if (!scanTarget.isFriendly) {
              if (scanTarget.pos.dist(obj.pos) < TURRET_RADIUS) {
                var angle = obj.pos.angle(scanTarget.pos)
                
                obj.angleToTargetPre = angle
                angle += 270

                var myAngle = obj.angle || 0
                if (myAngle > 360) myAngle -= 360;
                obj.angleToTargetMy = myAngle

                angle -= myAngle
                
                if (angle < 0)   angle = 360 - angle;
                if (angle > 360) angle -= 360;
                if (angle > 360) angle -= 360;

                if (angle >= 0   && angle <=  45) doChange(obj, 'north');
                if (angle >= 315 && angle <    0) doChange(obj, 'north');
                if (angle >= 45  && angle <= 135) doChange(obj, 'east');
                if (angle >= 135 && angle <= 225) doChange(obj, 'south');
                if (angle >= 225 && angle <  315) doChange(obj, 'west');

                obj.angleToTarget = angle

                if (Date.now() - obj.fireTTL > TURRET_FIRE_INTERVAL) {
                  // fire
                  var dir = scanTarget.pos.sub(obj.pos).unit();
                  console.log('fire', obj.fireTTL)
  
                  add(
                    [
                      pos(obj.pos),
                      move(dir, TURRET_BEAM_PROJECTILE_SPEED),
                      rect(2, 8),
                      rotate(obj.pos.angle(scanTarget.pos)),
                      area(),
                      offscreen( { destroy: true } ),
                      anchor('center'),
                      color(rgb(255,128,255)),
                      'turretBlast'
                    ]
                  );
                  obj.ammo --;
                  obj.fireTTL = Date.now()
                }                
              }
            }
          }
          break;
      
        default:
          if(obj.status == 'deployed') obj.state = 'scanEnemy'
          break;
      }      
    }
  };

  var addTurretAt = (location) => {
    const turret = add([
      sprite('tur'),
      pos(location),
      anchor('center'),
      area(),
      body(),
      "turret"
    ]);
    turret.menuCommand = getMenuCommandFunc(turret)
    turret.spriteObj   = getSprite(turret.sprite)
    turret.menu        = getMenuFunc(turret)
    turret.ai          = getTurretAI(turret)
    turret.menuColor   = rgb(rand(64, 128), rand(0, 64), rand(64, 128))
    turret.isMoving    = false
    turret.isFriendly  = true
    turret.status      = 'ready'
    turret.curTween    = null
    turret.energyHP    = 100
    turret.fireTTL     = Date.now()
    turret.ammo        = TURRET_MAX_AMMO
    turret.identity    = randomUUID()
    turret.onCollide('mobileFactory',    (obj) => { turret.energyHP -= (obj.status == 'deployed' ? 0.7 : 0.1) })
    turret.onCollide('mobileCommand',    (obj) => { turret.energyHP -= 0.1 })
    turret.onCollide('mobileMiningUnit', (obj) => { turret.energyHP -= 0.07 })
    deployment.push(turret)
    setTimeout(() => { updateDynamicOnEvents() }, 33);    
  };

  var addDroneDeploymentAt = (location) => {
    const droneDeployments = add([
      sprite('ddu'),
      pos(center()),
      anchor('center'),
      area(),
      body({ mass: DEPLOYED_MASS * 0.1 }),
      "droneDeployment"
    ]);
    droneDeployments.menuCommand = getMenuCommandFunc(droneDeployments)
    droneDeployments.spriteObj   = getSprite(droneDeployments.sprite)
    droneDeployments.menu        = getMenuFunc(droneDeployments)
    droneDeployments.isMoving    = false
    droneDeployments.isFriendly  = true
    droneDeployments.status      = 'ready'
    droneDeployments.curTween    = null
    droneDeployments.energyHP    = 100
    droneDeployments.identity    = randomUUID()  
    deployment.push(droneDeployments)
    setTimeout(() => { updateDynamicOnEvents() }, 33);   
  };

  var getEnemyScoutAI = (obj) => {
    return () => {
      var potentialTargets = []
      if (!obj.state) obj.state = ''

      // mode is based on damage and tenacity 
      const AI_MODE_DEFAULT = 0
      const AI_MODE_ATTACK  = 1
      const AI_MODE_PATROL  = 2
      const AI_MODE_FLEE    = 4

      obj.aiMode = AI_MODE_DEFAULT

      var dtFactor = ((100 - obj.energyHP) / 100) / obj.tenacity 

      if (dtFactor >= 0.0 && dtFactor < 0.5) obj.aiMode = AI_MODE_ATTACK
      if (dtFactor >= 0.5 && dtFactor < 0.7) obj.aiMode = AI_MODE_PATROL
      if (dtFactor >= 0.7 && dtFactor < 1.0) obj.aiMode = AI_MODE_FLEE

      switch (obj.state) {
        case 'attack':
          if (obj.aiMode == AI_MODE_ATTACK) {
            var target = obj.target;
            if (target) {
              if (target.pos.dist(obj.pos) < ENEMY_SCOUT_RADIUS) {
                if (Date.now() - obj.fireTTL > ENEMY_SCOUT_FIRE_INTERVAL) {
                  // fire
                  var dir = target.pos.sub(obj.pos).unit();

                  add(
                    [
                      pos(obj.pos),
                      move(dir, ENEMY_SCOUT_BEAM_PROJECTILE_SPEED),
                      rect(2, 8),
                      rotate(obj.angle),
                      area(),
                      offscreen( { destroy: true } ),
                      anchor('center'),
                      color(YELLOW),
                      'enemyScoutBlast'
                    ]
                  );
                  obj.fireTTL = Date.now()
                }
              }
            }
            obj.state = ''
          }
          else obj.state = ''
          
          break;

        case 'scanEnemy':
          for (let i = 0; i < deployment.length; i++) {
            const scanTarget = deployment[i];
            if (scanTarget.isFriendly) {
              if (scanTarget.pos.dist(obj.pos) < ENEMY_SCOUT_RADIUS) {
                potentialTargets.push(scanTarget)
              }
            }
          }

          self.potentialTargets = potentialTargets

          var target = (
            potentialTargets.find(t => t.tags[0] == 'turret')        ||
            potentialTargets.find(t => t.tags[0] == 'mobileFactory') || 
            potentialTargets.find(t => t.tags[0] == 'mobileCommand') ||
            potentialTargets.find(t => t.tags[0] == 'solarPanel') 
          );

          if (target) {
            if (obj.aiMode == AI_MODE_FLEE) {
              var angle    = obj.pos.angle(target.pos) 
              var distance = obj.pos.dist(target.pos)
      
              doTween(obj, obj.pos.add(Vec2.fromAngle(angle).scale(distance)) )
              obj.state = 'waitForTween'
            }
            else {
              // aim to target
              obj.angle = obj.pos.angle(target.pos) + 270
              obj.target = target

              // engage target 
              obj.state = 'attack'
            }
          }
          else {
            obj.state = 'patrol'
          }
          break;

        case 'patrol':
          if ( (obj.waypoints.length == 0) || (Math.random() > 0.9)) {
            var pos1 = obj.pos
            var pos2 = vec2(rand(0,width()), rand(0,height()))

            var bez  = getEieoBezier(pos1, pos2)
            
            obj.waypoints = []
            
            for (let t = 0.001; t < 0.999; t += 0.12) {
              obj.waypoints.push(evaluateBezier(bez.pt1, bez.pt2, bez.pt3, bez.pt4, t));
            }
          }
          var waypoint = obj.waypoints.shift()
          doTween(obj, waypoint)
          obj.state = 'waitForTween'

          break;

        case 'waitForTween':
          // wait for tween
          break;
        case 'endOfMove':
        default:
          obj.state = 'scanEnemy'
          break;
      }      


    }
  };

  var addEnemyScoutAt = (location) => {
    const enemyScout = add([
      sprite('ens'),
      pos(location),
      anchor('center'),
      area(),
      body(),
      rotate(randi(0,360)),
      "enemyScout"
    ]);
    enemyScout.menuCommand = getMenuCommandFunc(enemyScout)
    enemyScout.spriteObj   = getSprite(enemyScout.sprite)
    enemyScout.menu        = getMenuFunc(enemyScout)
    enemyScout.ai          = getEnemyScoutAI(enemyScout)
    enemyScout.status      = 'ready'
    enemyScout.target      = null
    enemyScout.energyHP    = 100
    enemyScout.curTween    = null
    enemyScout.isMoving    = false
    enemyScout.isFriendly  = false
    enemyScout.fireTTL     = Date.now()
    enemyScout.identity    = randomUUID()
    enemyScout.tenacity    = generateTenacity()
    enemyScout.waypoints   = []
    enemyScout.onCollide('mobileFactory',    (obj) => { enemyScout.energyHP -= (obj.status == 'deployed' ? 0.7 : 0.1) })
    enemyScout.onCollide('mobileCommand',    (obj) => { enemyScout.energyHP -= 0.1 })
    enemyScout.onCollide('mobileMiningUnit', (obj) => { enemyScout.energyHP -= 0.07 })
    deployment.push(enemyScout)
    setTimeout(() => { updateDynamicOnEvents() }, 33);    
  };

  var showStatusBars = (obj) => {
    if ('energyHP' in obj) {
      var healthEmote = formatText(
        {
          text:  '❤️',
          size:  6,
          pos:   obj.pos.add(-14, -28),
          fixed: true,
        }
      )
      drawFormattedText(healthEmote)
      
      var healthBar = {
        width: 47,
        height: 3,
        colors: {
          border: rgb(0, 0, 0),
          bar: rgb(50, 205, 50)
        }
      }
      healthBar.filled = healthBar.width * (obj.energyHP / 100)
      healthBar.pos    = obj.pos.add(-5, -27)

      // draw border
      var healthBorder = {
        width:   healthBar.width,
        height:  healthBar.height,
        pos:     healthBar.pos,
        fill:    false,
        outline: { color: healthBar.colors.border }
      };
      drawRect(healthBorder);

      // draw filled
      var healthFilled = {
        width:   healthBar.filled,
        height:  healthBar.height,
        color:   healthBar.colors.bar,
        pos:     healthBar.pos,
        fill:    true
      };
      drawRect(healthFilled);
    }

    if ('ammo' in obj) {
      // 💣
      var ammoEmote = formatText(
        {
          text:  '💥',
          size:  6,
          pos:   obj.pos.add(-14, -36),
          fixed: true,
        }
      )
      drawFormattedText(ammoEmote)

      var ammoBar = {
        width: 47,
        height: 3,
        colors: {
          border: rgb(0, 0, 0),
          bar: rgb(128, 128, 205)
        }
      }
      ammoBar.filled = ammoBar.width * (obj.ammo / TURRET_MAX_AMMO)
      ammoBar.pos    = obj.pos.add(-5, -35)

      // draw border
      var ammoBorder = {
        width:   ammoBar.width,
        height:  ammoBar.height,
        pos:     ammoBar.pos,
        fill:    false,
        outline: { color: ammoBar.colors.border }
      };
      drawRect(ammoBorder);

      // draw filled
      var ammoFilled = {
        width:   ammoBar.filled,
        height:  ammoBar.height,
        color:   ammoBar.colors.bar,
        pos:     ammoBar.pos,
        fill:    true
      };
      drawRect(ammoFilled);
    }

    if (obj.tags[0] == 'mobileMiningUnit') {
      // ⛏
      var oreLevelEmote = formatText(
        {
          text:  '⛏️',
          size:  6,
          pos:   obj.pos.add(-14, -36),
          fixed: true,
        }
      )
      drawFormattedText(oreLevelEmote)

      var oreLevelBar = {
        width: 47,
        height: 3,
        colors: {
          border: rgb(0, 0, 0),
          bar: rgb(0, 255, 255)
        }
      }
      oreLevelBar.filled = Math.min(oreLevelBar.width * (obj.oreLevel / MINING_UNIT_CAPACITY), 100)
      oreLevelBar.pos    = obj.pos.add(-5, -35)

      // draw border
      var oreLevelBorder = {
        width:   oreLevelBar.width,
        height:  oreLevelBar.height,
        pos:     oreLevelBar.pos,
        fill:    false,
        outline: { color: oreLevelBar.colors.border }
      };
      drawRect(oreLevelBorder);

      // draw filled
      var oreLevelFilled = {
        width:   oreLevelBar.filled,
        height:  oreLevelBar.height,
        color:   oreLevelBar.colors.bar,
        pos:     oreLevelBar.pos,
        fill:    true
      };
      drawRect(oreLevelFilled);
    }
  };

  var getEieoBezier = (pos1, pos2) => {
    var pt1 = pos1;
    var pt4 = pos2;
    var pxd = (Math.abs(pt1.x - pt4.x)/2) + pt1.x
    
    var pt2 = vec2(pxd, pt1.y);
    var pt3 = vec2(pxd, pt4.y);            
    return { pt1, pt2, pt3, pt4 };
  };

  var debugHealth = () => {
    deployment.forEach((obj) => { console.log(`${obj.tags[0]}: ${obj.energyHP}`) })
  };

  var hasPower = (obj) => {
    var powered = false
    deployment.forEach(
      (itm) => {
        if ( itm.tags[0] == 'solarPanel') {
          if ( itm.status == 'deployed' ) {
            if (obj.pos.dist(itm.pos) < SOLAR_POWER_SENDING_RADIUS) powered = true
          }
        }
      }
    )
    return powered;
  };

  var hasDroneDelivery = () => {
    var delivery = false
    deployment.forEach(
      (itm) => {
        if ( itm.tags[0] == 'droneDeployment') {
          if ( itm.status == 'deployed' ) {
            delivery = true
          }
        }
      }
    )
    return delivery;
  };

  var getClosestDroneDeployer = (obj) => {
    var closestDroneDeployment = null
    var possibleDroneDeployers = []
    deployment.forEach(
      (itm) => {
        if ( itm.tags[0] == 'droneDeployment') {
          if ( itm.status == 'deployed' ) {
            possibleDroneDeployers.push(
              {
                distance: obj.pos.dist(itm.pos),
                object: itm,
                identity: itm.identity
              }
            );
          }
        }
      }
    );
    possibleDroneDeployers.sort((a, b) => a.distance - b.distance);
    closestDroneDeployment = possibleDroneDeployers.shift()

    return closestDroneDeployment.object;
  };

  var dispatchDrone = (from, to, type) => {

    const drone = add([
      sprite('drn'),
      pos(from.pos),
      anchor('center'),
      "drone"
    ]);
    drone.isMoving    = true
    drone.isFriendly  = true
    doChange(drone, 'moving')

    var toLocation = to.pos

    drone.curTween = tween(
      from.pos,
      toLocation,
      (duration / 10) * drone.pos.dist(toLocation),
      (val) => {
        drone.pos = val
      },
      easings.easeInOutSine
    )
    .then(
      () => {
        drone.curTween = tween(drone.pos, to.pos, 0.1, (val) => {drone.pos = val }, easings.easeInOutSine)
        .then(
          () => {
            switch (type) {
              case 'A':
                to.ammo = TURRET_MAX_AMMO
                break;
            
              case 'H':
                to.energyHP = 100
                break;
            }
            destroy(drone)
          }
        );
      }
    )   
  };

  var pickOne = (arr) => {
    var i = randi(0, arr.length)
    return arr[i]
  };

  var { mobileFactory, mobileCommand, solarPanel } = initialSet()

  var deployment = [
    mobileFactory,
    mobileCommand,
    solarPanel
  ]

  updateDynamicOnEvents()
  doChange(mobileFactory, 'ready')

  mobileCommand.move( vec2(mobileCommand.pos.x, mobileCommand.pos.y + 175) )
  solarPanel.move( vec2(solarPanel.pos.x, solarPanel.pos.y + 75) )

  // events

  onUpdate(
    () => {
      var deleted = [];
      for (let i = 0; i < deployment.length; i++) {
        const obj = deployment[i];
        if ( obj.ai ) obj.ai();
        if ( obj.energyHP <= 0 ) deleted.push({ i, obj })
      };
      deleted.sort((a, b) => a.i < b.i);
      for (let n = 0; n < deleted.length; n++) {
        const item = deleted[n];
        deployment.splice(item.i, 1)
        if (item.obj == selected) selected = null;
        destroy(item.obj)
      }
    }
  );

  onDraw(
    () => {
      if (selected) {
        selected.menu()
        showStatusBars(selected)

        if ( selected.tags[0] == 'solarPanel') {
          if ( selected.status == 'deployed' ) {
            drawCircle({
              pos: selected.pos,
              radius: SOLAR_POWER_SENDING_RADIUS,
              fill: true,
              opacity: 0.067,
              color: rgb(0,255,0)
            })            
          }
        }
        
        drawCircle({
          pos: selected.pos,
          radius: selected.width * 0.66,
          fill: false,
          outline: {
            width: 1,
            color: rgb(rand(192, 255), rand(192, 255), rand(192, 255)),
          },
        })
      }
    }
  );
  
  onMousePress(
    'left',
    (button) => {
      console.dir(mousePos())
      var objPressed = false;
      for (let i = 0; i < deployment.length; i++) {
        const obj = deployment[i];
        if ( obj.isClicked() ) objPressed = true
      }
      if (!objPressed) {
        if (selected) {
          if (selected.isMoving) {
            selected.isMoving = false
            moveNow(selected)
          }
        }
        selected = null
      }
    }
  );

  onMousePress(
    'right',
    (button) => {
      addEnemyScoutAt(mousePos())
    }
  );

  onKeyPress(
    (key) => {
      if (selected) {
        selected.menuCommand(key)
      }
    }
  );

  onScroll(
    (delta) => {
      var scale
      if (delta.y > 0) {
        // zoom out
        scale = camScale().x * 0.9
      }
      else {
        // zoom in
        scale = camScale().x * 1.1
      }
      camScale(scale, scale)
    }
  );








  function initialSet() {

    const mobileFactory = add([
      sprite('mfg'),
      pos(center()),
      anchor('center'),
      area(),
      body({ mass: 10 }),
      "mobileFactory"
    ]);
    mobileFactory.menuCommand  = getMenuCommandFunc(mobileFactory)
    mobileFactory.spriteObj    = getSprite(mobileFactory.sprite)
    mobileFactory.menu         = getMenuFunc(mobileFactory)
    mobileFactory.isMoving     = false
    mobileFactory.isFriendly   = true
    mobileFactory.isBusy       = false
    mobileFactory.status       = null
    mobileFactory.curTween     = null
    mobileFactory.energyHP     = 100
    mobileFactory.oreLevel     = 0
    mobileFactory.numberOfCrew = 9
    mobileFactory.identity     = randomUUID()

    const mobileCommand = add([
      sprite('mcv'),
      pos(center()),
      anchor('center'),
      area(),
      body({ mass: DEPLOYED_MASS * 0.1 }),
      "mobileCommand"
    ]);
    mobileCommand.menuCommand = getMenuCommandFunc(mobileCommand)
    mobileCommand.spriteObj   = getSprite(mobileCommand.sprite)
    mobileCommand.menu        = getMenuFunc(mobileCommand)
    mobileCommand.isMoving    = false
    mobileCommand.isFriendly  = true
    mobileCommand.status      = 'ready'
    mobileCommand.curTween    = null
    mobileCommand.energyHP    = 100
    mobileCommand.identity    = randomUUID()

    const solarPanel = add([
      sprite('sol'),
      pos(center()),
      anchor('center'),
      area(),
      body({ mass: DEPLOYED_MASS * 0.1 }),
      "solarPanel"
    ]);
    solarPanel.menuCommand    = getMenuCommandFunc(solarPanel)
    solarPanel.spriteObj      = getSprite(solarPanel.sprite)
    solarPanel.menu           = getMenuFunc(solarPanel)
    solarPanel.isMoving       = false
    solarPanel.isFriendly     = true
    solarPanel.status         = 'ready'
    solarPanel.curTween       = null
    solarPanel.energyHP       = 100
    solarPanel.identity       = randomUUID()
    solarPanel.postDeployFunc = () => {
      debug.log('Power online...')
    }
    solarPanel.postPackupFunc = () => {
      debug.log('Power offline...')
    }

    return { mobileFactory, mobileCommand, solarPanel } ;
  }

  function loadSprites() {
    // load sprites
    loadSprite('mfg', 
      './assets/img/mfg-sprite-sheet-v3.png', 
      {
        sliceX: 12,
        anims: {
          'ready': 0,
          'moving': {
              from: 0,
              to: 3,
              speed: 5,
              loop: true,
          },
          'deploy': {
              from: 4,
              to: 9,
              speed: 5,
              loop: false,
          },
          'deployed': {
              from: 8,
              to: 11,
              speed: 5,
              loop: true,
          },
          'bundle': {
              from: 9,
              to: 4,
              speed: 4,
              loop: false,
          },
        },
      }
    );
    loadSprite('mcv', 
      './assets/img/mobile-command-vehicle-v2.png', 
      {
        sliceX: 3,
        anims: {
          'ready': 0,
          'moving': {
              from: 0,
              to: 2,
              speed: 5,
              loop: true,
          }
        },
      }
    );
    loadSprite('mmu', 
      './assets/img/mobile-mining-unit-v1.png', 
      {
        sliceX: 11,
        anims: {
          'ready': 0,
          'moving': {
              from: 0,
              to: 4,
              speed: 5,
              loop: true,
          },
          'collect': {
              from: 5,
              to: 10,
              speed: 5,
              loop: false,
          }
        }
      }
    );
    loadSprite('bck', 
      './assets/img/moon-landscape-background-lite-v2.png'
    );
    loadSprite('tur', 
      './assets/img/turret-sprite-sheet-v2.png', 
      {
        sliceX: 12,
        anims: {
          'ready': 0,
          'moving': {
              from: 0,
              to: 3,
              speed: 5,
              loop: true,
          },
          'deploy': {
              from: 4,
              to: 8,
              speed: 5,
              loop: false,
          },
          'deployed': 8,
          'bundle': {
              from: 8,
              to: 4,
              speed: 4,
              loop: false,
          },
          'north': 8,
          'east': 9,
          'south': 10,
          'west': 11,
        },
      }
    );
    loadSprite('sol', 
      './assets/img/solarPower-v1.png', 
      {
        sliceX: 21,
        anims: {
          'ready': 0,
          'moving': {
            from: 17,
            to: 20,
            speed: 5,
            loop: true,
          },
          'deploy': {
            from: 0,
            to: 16,
            speed: 5,
            loop: false,
          },
          'deployed': 16,
          'bundle': {
            from: 16,
            to: 0,
            speed: 5,
            loop: false,
          }
        },
      }
    );
    loadSprite('ens', 
      './assets/img/enemy-scoutsprite-sheet-v2.png', 
      {
        sliceX: 5,
        anims: {
          'ready': 0,
          'moving': {
            from: 1,
            to: 4,
            speed: 5,
            loop: true,
          }
        }
      }
    );
    loadSprite('drn', 
      './assets/img/drone-sheet-v1.png', 
      {
        sliceX: 4,
        anims: {
          'moving': {
            from: 0,
            to: 3,
            speed: 10,
            loop: true,
          }
        }
      }
    );
    loadSprite('ddu', 
      './assets/img/drone-deployment-sheet-v2.png', 
      {
        sliceX: 12,
        anims: {
          'ready': 0,
          'moving': {
              from: 1,
              to: 3,
              speed: 5,
              loop: true,
          },
          'deploy': {
              from: 4,
              to: 10,
              speed: 5,
              loop: false,
          },
          'deployed': {
              from: 10,
              to: 11,
              speed: 5,
              loop: true,
          },
          'bundle': {
              from: 10,
              to: 4,
              speed: 4,
              loop: false,
          },
        },
      }
    );
  }

  function loadDialog() {
    const MESSAGES_NO_POWER = [
      `Where's the power?`, 
      'No nearby power source', 
      'Need power!', 
      'No power online', 
      'Power is still down', 
      'No Power yet', 
      'No online power sources.', 
      'Power offline!'
    ];
    
    const MESSAGES_NO_CREW = [
      `No crew left to command`,
      `Who's gonna drive that?`,
      `Crew has been depleted`,
      `Need drivers to command unit`,
    ];

    return {
      MESSAGES_NO_POWER,
      MESSAGES_NO_CREW
    };
  }

  function randomUUID() {
    //9ea98e5e-225a-484b-aef6-436a2f90be65
    return `${(Math.random()*6e16).toString(16).substring(0,8)}-${(Math.random()*6e16).toString(16).substring(0,4)}-${(Math.random()*6e16).toString(16).substring(0,4)}-${(Math.random()*6e16).toString(16).substring(0,4)}-${(Math.random()*6e16).toString(16).substring(0,6)}${(Math.random()*6e16).toString(16).substring(0,6)}`;
  }
  
  function generateTenacity() {
    
    var aggresion = rand(0.4, 1.0)
    var strength  = rand(0.3, 1.0)
    var courage   = rand(0.6, 1.0)

    return  ((aggresion + strength + courage) / 3)
  }