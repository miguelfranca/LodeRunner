/*     Lode Runner

Aluno 1: 55622 Miguel França
Aluno 2: 55926 Joao Palmeiro

Comentario:

O ficheiro "LodeRunner.js" tem de incluir, logo nas primeiras linhas,
um comentário inicial contendo: o nome e número dos dois alunos que
realizaram o projeto; indicação de quais as partes do trabalho que
foram feitas e das que não foram feitas (para facilitar uma correção
sem enganos); ainda possivelmente alertando para alguns aspetos da
implementação que possam ser menos óbvios para o avaliador.

Programa feito na totalidade. E possivel realizar praticamente todas as acoes
descritas no enunciado, com excecao de alguns casos pontuais em que exista
ainda um bug, que impossibilite que se mostre a imagem certa ou que se realize
o movimento pretendido.
O programa foi reestruturado para poder ser mais extensivel e flexivel em
futuras implementacoes, principalmente com adicao de novas classes para
controlar os estados e o jogo em geral.
 */

// GLOBAL VARIABLES
const SCORE_PER_GOLD = 100;

// const RESPAWN_TIME_BRICK = 8 * ANIMATION_EVENTS_PER_SECOND; // doesnt run on mooshak
// const RESPAWN_TIME_ROBOT = 3 * ANIMATION_EVENTS_PER_SECOND;
const RESPAWN_TIME_BRICK = 8 * 8; // ANIMATION_EVENTS_PER_SECOND units
const RESPAWN_TIME_ROBOT = 3 * 8; // ANIMATION_EVENTS_PER_SECOND units

const HERO_SHOOT_ANIM = 500; // milliseconds
const ROBOT_DUMB_ANIM = 1000; // milliseconds
// the robots after respawning, because they died in a hole made by the hero, 
// dont move for awhile (dumb/stunned) 

const directions =
{
    LEFT: "left",
    RIGHT: "right",
    UP: "up",
    DOWN: "down"
}

let empty, hero, control;

function onLoad()
{
    // Asynchronously load the images an then run the game
    GameImages.loadAll(function ()
    {
        new GameControl();
    }
    );
    onCanvasLoad();
}

function onCanvasLoad()
{
    let canvas = document.getElementById("canvas1");

    canvas.width = 504;
    canvas.height = 272;

    scaleCanvas(50, 50);
}

function scaleCanvas(x, y){
    let canvas = document.getElementById("canvas1");

    canvas.style.width = (screen.width * x / 100) + "px";
    canvas.style.height = (screen.height * y / 100) + "px";
}

class GameControl
{
    constructor()
    {
        control = this;

        this.canvas = document.getElementById("canvas1");
        this.ctx = this.canvas.getContext("2d");
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // please take a second to apprecciate how beautiful this is (despite the 1500 lines of code)
        this.statesMachine = new StatesMachine();
        this.mainMenuState = new MainMenuState();
        this.gameOverState = new GameOverState();
        this.gameState = new GameState();

        this.statesMachine.addState("GameOver", this.gameOverState);
        this.statesMachine.addState("Game", this.gameState);
        this.statesMachine.changeState("MainMenu", this.mainMenuState);
    }

    clearCanvas()
    {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}

// switch between the given images
class Animation
{
    constructor(images)
    {
        this.images = images;
        this.currentImage = 0;
    }

    step()
    {
        if (this.currentImage > this.images.length - 1)
            this.currentImage = 0;

        return this.images[this.currentImage++];
    }
}

// keeps track of the 2 most recent blocks passed through
// and calls func everytime the 2 functions are satisfied
class ActorEvent
{
    constructor(prev, cur, func, obj)
    {
        this.previousBlockFunc = prev;
        this.currentBlockFunc = cur;

        // starts with null and empty assuming the given actor has an empty block behind on spawn
        this.previousBlock = null;
        this.currentBlock = empty;

        this.func = func;
        this.obj = obj;
    }

    check(x, y)
    {
        this.previousBlock = this.currentBlock;
        this.currentBlock = control.gameState.getBehind(x, y);

        if (this.previousBlock == null || this.currentBlock == null)
            return false;

        if (this.previousBlockFunc(this.previousBlock) &&
            this.currentBlockFunc(this.currentBlock))
        {
            this.func(this.obj);
            return true;
        }
        else
            return false;
    }
}

class Actor
{
    constructor(x, y, imageName)
    {
        this.time = 0; // timestamp used in the control of the animations
        this.x = x;
        this.y = y;
        this.imageName = imageName;
        this.show();
    }

    draw(x, y)
    {
        control.ctx.drawImage(GameImages[this.imageName],
            x * ACTOR_PIXELS_X, y * ACTOR_PIXELS_Y);
    }

    isSolid()
    {
        return false;
    } // should be here in case we want to add an active actor that one is not able to pass through

    isClimbable()
    {
        return false;
    } // same here

    isEmpty()
    {
        return false;
    }

    isFellable()
    {
        return false;
    }

    isDeadly()
    {
        return false;
    }

    animation() {}

    isKind()
    {
        return false;
    } // the hero is a kind and generous actor :)
}

class PassiveActor extends Actor
{
    constructor(x, y, imageName)
    {
        super(x, y, imageName);
    }
    show()
    {
        control.gameState.world[this.x][this.y] = this;
        this.draw(this.x, this.y);
    }

    hide()
    {
        control.gameState.world[this.x][this.y] = empty;
        empty.draw(this.x, this.y);
    }

    isBreakable()
    {
        return false;
    }
    isGrabable()
    {
        return false;
    }
    isItem()
    {
        return false;
    }
    isVisible()
    {
        return true;
    }

    isBoundary()
    {
        return false;
    }
}

class ActiveActor extends Actor
{
    constructor(x, y, imageName)
    {
        super(x, y, imageName);

        this.climbingAnimation = null;
        this.moveDirection = directions.LEFT;
        this.items = [];

        // two-block animations (ex. going through a ladder comming from an empty block)
        this.transitions = [
            this.climbTrans = new ActorEvent(
                function (x) { return true; },
                function (x) { return x.isClimbable() && x.isVisible(); }, 
                this.climb, this),

            this.leaveClimb = new ActorEvent(
                function (x) { return x.isClimbable(); }, 
                function (x) { return x.isEmpty(); },
                this.lclimb, this),

            this.runningTrans = new ActorEvent(
                function (x) { return x.isEmpty() || x.isGrabable() || x.isItem(); }, 
                function (x) { return x.isEmpty(); },
                this.run, this),

            this.grabTrans = new ActorEvent(
                function (x) { return true; }, 
                function (x) { return x.isGrabable(); },
                this.grab, this)
        ]
    }

    show()
    {
        control.gameState.worldActive[this.x][this.y] = this;
        this.draw(this.x, this.y);
    }

    hide()
    {
        control.gameState.worldActive[this.x][this.y] = empty;
        control.gameState.world[this.x][this.y].draw(this.x, this.y);
    }

    die()
    {
        this.hide();
    }

    update(dx, dy)
    {
        this.hide();
        this.updatePos(dx, dy);
        this.show();
    }

    updateImg()
    {
        this.hide();
        this.show();
    }

    updatePos(dx, dy)
    {
        this.x += dx;
        this.y += dy;
    }

    move(dx, dy)
    {
        // check if direction of movement is changing
        let aux =
            (this.moveDirection === directions.RIGHT && dx < 0
             || this.moveDirection === directions.LEFT && dx > 0);

        if (dx > 0)
            this.moveDirection = directions.RIGHT;
        else if (dx < 0)
            this.moveDirection = directions.LEFT;

        this.checkTransitions(dx, dy);

        // dont move, just change sprite
        if (aux)
        {
            let current = control.gameState.getBehind(this.x, this.y);

            if (current.isEmpty())
                this.run(this);

            if (current.isGrabable())
                this.grab(this);

            if (!current.isClimbable())
                this.updateImg();
        }
        else
            this.tryToMove(dx, dy);
    }

    tryToMove(dx, dy)
    {
        let next = control.gameState.get(this.x + dx, this.y + dy);
        let current = control.gameState.getBehind(this.x, this.y);

        if ((dy < 0 && !current.isClimbable()))
            return;

        if (!next.isSolid() && (current.isVisible() || dy >= 0))
        {
            this.hide();
            if (!this.isFalling())
                this.updatePos(dx, dy);

            this.grabItem();

            if (this.isFalling())
                this.fall();

            this.show();
        }
    }

    checkTransitions(dx, dy)
    {
        for (let i = 0; i < this.transitions.length; ++i)
        {
            if (this.transitions[i].check(this.x + dx, this.y + dy))
                break;
        }
    }

    grabItem() {}

    isFalling()
    {
        let behind = control.gameState.getBehind(this.x, this.y);
        let atFeet = control.gameState.get(this.x, this.y + 1);

        return !behind.isGrabable() && atFeet.isFellable()
         && !atFeet.isClimbable() && !behind.isClimbable();
    }

    animation()
    {
        if (this.isFalling())
        {
            if (this.time % 3 == 0) // slow down fall
                this.update(0, 1);

            let behind = control.gameState.getBehind(this.x, this.y);
            if (behind.isItem())
                this.grabItem();

            this.falling = true;
        }

        // stopped falling, sprite changes automatically
        if (this.falling && !this.isFalling())
        {
            let behind = control.gameState.getBehind(this.x, this.y);

            if (!behind.isGrabable())
                this.run(this);
            else
                this.grab(this);

            this.grabItem();
            this.updateImg();

            this.falling = false;
        }
    }
}

class Hero extends ActiveActor
{
    constructor(x, y)
    {
        super(x, y, "hero_runs_left");

        this.climbingAnimation = new Animation(["hero_on_ladder_left", "hero_on_ladder_right"]);
    }

    // specialize all the animations (automatically called from super)
    climb(obj)
    {
        obj.imageName = obj.climbingAnimation.step();
    }

    lclimb(obj)
    {
        if (obj.moveDirection === directions.LEFT)
            obj.imageName = "hero_runs_left";
        else
            obj.imageName = "hero_runs_right";
    }

    grab(obj)
    {
        if (obj.moveDirection === directions.LEFT)
            obj.imageName = "hero_on_rope_left";
        else
            obj.imageName = "hero_on_rope_right";

    }

    lgrab(obj)
    {
        if (obj.isFalling())
            obj.fall();
        else
            obj.run(obj);
    }

    fall()
    {
        if (this.moveDirection === directions.LEFT)
            this.imageName = "hero_falls_left";
        else
            this.imageName = "hero_falls_right";
    }

    run(obj)
    {
        if (obj.moveDirection === directions.LEFT)
            obj.imageName = "hero_runs_left";
        else if (obj.moveDirection === directions.RIGHT)
            obj.imageName = "hero_runs_right";
    }

    shooting()
    {
        if (this.moveDirection === directions.LEFT)
            this.imageName = "hero_shoots_left";
        else if (this.moveDirection === directions.RIGHT)
            this.imageName = "hero_shoots_right";
    }

    die()
    {
        super.die();
        control.statesMachine.changeState("GameOver");
    }

    // should he have more lives? no
    hurt()
    {
        this.die();
    }

    move(dx, dy)
    {
        let next = control.gameState.get(this.x + dx, this.y + dy);
        let current = control.gameState.getBehind(this.x, this.y);

        if (next.isDeadly())
        {
            this.hurt();
            return;
        }

        super.move(dx, dy);

        // yooo next level
        if (this.y === 0 && this.items.length === control.gameState.grabedItems 
            && current.isClimbable())
            control.gameState.loadNextLevel();
    }

    grabItem()
    {
        super.grabItem();

        let aux = control.gameState.world[this.x][this.y];
        if (aux.isItem())
        {
            this.items.push(aux);
            aux.pickUp();

            control.gameState.score += SCORE_PER_GOLD;
        }

        if (this.items.length === control.gameState.grabedItems)
            control.gameState.makeLadderVisible();
    }

    shoot()
    {
        let behind = control.gameState.getBehind(this.x, this.y);

        if (this.isFalling() || behind.isGrabable() || behind.isClimbable())
            return;

        let target = null;

        if (this.moveDirection === directions.RIGHT)
            target = control.gameState.get(this.x + 1, this.y + 1);
        else
            target = control.gameState.get(this.x - 1, this.y + 1);

        let aboveTarget = control.gameState.get(target.x, target.y - 1);
        let recoilPosition = control.gameState.get(this.x + (this.x - target.x), this.y + 1);

        if (target.isBreakable() && !aboveTarget.isSolid() && !target.isBroken())
        {
            target.setBroken(true);

            if (!recoilPosition.isFellable())
                this.tryToMove(this.x - target.x, 0);

            this.shooting();
            this.updateImg();
            // move (0, 0) will set the image back to normal
            setTimeout(function ()
            {
                hero.move(0, 0);
            }, HERO_SHOOT_ANIM);
        }
    }

    animation()
    {
        let atFeet = control.gameState.get(this.x, this.y + 1);
        if (atFeet.isDeadly() && this.isFalling())
            this.hurt();

        super.animation();

        let k = control.gameState.getKey();

        if (k == ' ')
        {
            this.shoot();
            return;
        }
        else
            if (k != null)
            {
                let[dx, dy] = k;

                this.move(dx, dy);
            }
    }

    isKind()
    {
        return true;
    }
}

class Robot extends ActiveActor
{
    constructor(x, y)
    {
        super(x, y, "robot_runs_right");
        this.dx = 1;
        this.dy = 0;

        this.timeOfStun = -1;
        this.respawnTime = RESPAWN_TIME_ROBOT;
        this.dumbTime = false;

        this.stunned = false;

        this.climbingAnimation = new Animation(["robot_on_ladder_left", "robot_on_ladder_right"]);
    }

    climb(obj)
    {
        obj.imageName = obj.climbingAnimation.step();
    }

    lclimb(obj)
    {
        if (obj.moveDirection === directions.LEFT)
            obj.imageName = "robot_runs_left";
        else
            obj.imageName = "robot_runs_right";
    }

    grab(obj)
    {
        if (obj.moveDirection === directions.LEFT)
            obj.imageName = "robot_on_rope_left";
        else
            obj.imageName = "robot_on_rope_right";

    }

    lgrab(obj)
    {
        if (obj.isFalling())
            obj.fall();
        else
            obj.run(obj);
    }

    fall()
    {
        if (this.moveDirection === directions.LEFT)
            this.imageName = "robot_falls_left";
        else
            this.imageName = "robot_falls_right";
    }

    run(obj)
    {
        if (obj.moveDirection === directions.LEFT)
            obj.imageName = "robot_runs_left";
        else if (obj.moveDirection === directions.RIGHT)
            obj.imageName = "robot_runs_right";
    }

    grabItem()
    {
        super.grabItem();
        let aux = control.gameState.world[this.x][this.y];

        if (this.items.length == 0 && aux.isItem())
        {
            this.items.push(aux);
            aux.pickUp();
        }
    }

    move(dx, dy)
    {
        let next = control.gameState.get(this.x + dx, this.y + dy);
        let oldCoords = [this.x, this.y];

        if (!(next.isDeadly()))
            super.move(dx, dy);

        let newCoords = [this.x, this.y];

        if (oldCoords != newCoords && next.isKind())
        {
            // commit murder
            next.hurt();
            this.show();
        }
    }

    animation()
    {
        if (!this.stunned)
        {
            let current = control.gameState.getBehind(this.x, this.y);

            // get trapped
            if (current.isBreakable() && current.isBroken())
            {
                this.timeOfStun = this.time;
                this.stun();
                if (this.items.length > 0)
                {
                    let item = this.items[0];
                    item.drop(this.x, this.y - 1);
                    this.items = [];
                }
                return;
            }

            let possibleFall = control.gameState.get(this.x, this.y + 1);
            if (!(possibleFall.isDeadly()))
                super.animation();
        }

        // get out of the hole
        if (!this.dumbTime && this.stunned &&
            (this.time - this.timeOfStun > this.respawnTime))
        {
            setTimeout((function (robot)
                {
                    return function ()
                    {
                        robot.stunned = false;
                        robot.timeOfStun = -1;
                        robot.dumbTime = false;
                    }
                }
                )(this), ROBOT_DUMB_ANIM);

            this.dumbTime = true;

            this.stunned = false;
            this.timeOfStun = -1;

            let mov = (hero.x - this.x);

            let prevBlock = control.gameState.getBehind(this.x, this.y);

            this.update(mov <= -1 ? -1 : 1, -1);
            prevBlock.reGrow();
            this.grabItem();
        }

        if (!this.isFalling())
            this.decideMovement(hero.x, hero.y);
    }

    decideMovement(x, y)
    {
        if (this.stunned || this.dumbTime || this.time % 5 != 0)
            return;

        let oldCoords = [this.x, this.y];

        // try to move on y axis
        if (this.y > y)
            this.move(0, -1);
        else if (this.y < y)
            this.move(0, 1);

        let newCoords = [this.x, this.y];

        // if didnt move on y axis move on x
        if (oldCoords != newCoords)
        {
            if (this.x > x)
                this.move(-1, 0);
            else if (this.x < x)
                this.move(1, 0);
        }
    }

    stun()
    {
        this.stunned = true;
    }

    isFellable()
    {
        return !this.stunned;
    }

    isDeadly()
    {
        return true;
    }

}

// class Respawnable extends PassiveActor
// {
// }

class Breakable extends PassiveActor
{
    constructor(x, y, img)
    {
        super(x, y, img);
        this.image = img;
        this.broken = false;
    }
    setBroken(boolVal)
    {
        this.broken = boolVal;
        if (boolVal)
            this.imageName = "empty";
        else
            this.imageName = this.image;
        this.show();
    }

    isFellable()
    {
        return this.broken;
    }
    isBroken()
    {
        return this.broken;
    }
    isSolid()
    {
        return !this.broken;
    }
    isBreakable()
    {
        return true;
    }
    isEmpty()
    {
        return this.broken;
    }
}

class Brick extends Breakable
{
    constructor(x, y)
    {
        super(x, y, "brick");
        this.timeOfBreak = -1;
        this.respawnTime = RESPAWN_TIME_BRICK;
    }

    setBroken(boolVal)
    {
        super.setBroken(boolVal);
        this.timeOfBreak = this.time;
    }

    reGrow()
    {
        let inSamePos = control.gameState.get(this.x, this.y);
        if (inSamePos instanceof ActiveActor)
            inSamePos.die();
        this.setBroken(false);
        this.timeOfBreak = -1;
    }

    animation()
    {
        if (this.broken && (this.time - this.timeOfBreak > this.respawnTime))
            this.reGrow();
    }
}

class Chimney extends PassiveActor
{
    constructor(x, y)
    {
        super(x, y, "chimney");
    }

    isFellable()
    {
        return true;
    }
}

class Empty extends PassiveActor
{
    constructor()
    {
        super(-1, -1, "empty");
    }

    show() {}
    hide() {}

    isFellable()
    {
        return true;
    }

    isEmpty()
    {
        return true;
    }
}

class Item extends PassiveActor
{
    constructor(x, y, img)
    {
        super(x, y, img);
        this.wasBehind = null;
    }

    pickUp()
    {
        this.hide();
        if (this.wasBehind !== null)
            this.wasBehind.show();

        control.gameState.get(this.x, this.y).show();
    }

    drop(x, y)
    {
        this.wasBehind = control.gameState.getBehind(x, y);
        this.x = x;
        this.y = y;
        this.show();
    }

    isItem()
    {
        return true;
    }
    isFellable()
    {
        return true;
    }
}

class Gold extends Item
{
    constructor(x, y)
    {
        super(x, y, "gold");
    }
}

class Invalid extends PassiveActor
{
    constructor(x, y)
    {
        super(x, y, "invalid");
    }
}

class Ladder extends PassiveActor
{
    constructor(x, y)
    {
        super(x, y, "empty");
        this.visiblility = false;
    }

    makeVisible()
    {
        this.visiblility = true;
        this.imageName = "ladder";
        this.show();
    }

    isEmpty()
    {
        return !this.visiblility;
    }

    isVisible()
    {
        return this.visiblility;
    }

    isClimbable()
    {
        return this.visiblility;
    }
}

class Rope extends PassiveActor
{
    constructor(x, y)
    {
        super(x, y, "rope");
    }
    isGrabable()
    {
        return true;
    }

    isFellable()
    {
        return true;
    }
}

class Stone extends PassiveActor
{
    constructor(x, y)
    {
        super(x, y, "stone");
    }

    isSolid()
    {
        return true;
    }
}

class BoundaryStone extends Stone
{
    constructor()
    {
        super(-1, -1);
    }
    show() {}
    hide() {}

    isBoundary()
    {
        return true;
    }
}

// manager to switch between states
class StatesMachine
{
    constructor()
    {
        this.currentState = null;
        this.states = new Map();
        this.activeStates = new Map();
    }

    addState(name, state)
    {
        this.states.set(name, state);
    }

    changeState(name, state = null)
    {
        if (!this.states.has(name))
        {
            if (state == null)
                msg("Trying to change to null state: " + name);
            else
                this.addState(name, state);
        }

        let oldState = this.currentState;
        this.currentState = name;

        if (oldState !== null)
            this.states.get(oldState).unload();

        this.states.get(this.currentState).load();

        if (this.activeStates.has(this.currentState))
            this.states.get(this.currentState).onSwitch(oldState);
        else
        {
            this.activeStates.set(this.currentState, this.states[this.currentState]);
            this.states.get(this.currentState).onCreate();
        }
    }

    deleteState(name)
    {
        if (!states.has(name))
            msg("Trying to delete a state that does not exist! error: " + name);

        this.states.get(name).onDestroy();
        this.states.delete(name);
    }
}

class State
{
    constructor() {}

    load() {}
    unload() {}

    onCreate() {}

    onSwitch(oldState) {}

    onDestroy() {}
}

class GameState extends State
{

    constructor()
    {
        super();
    }

    onCreate()
    {
        this.boundaryStone = new BoundaryStone();

        this.key = 0;
        this.score = 0;

        this.time = 0;

        empty = new Empty();

        this.world = this.createMatrix();
        this.worldActive = this.createMatrix();

        this.currentLevel = 1;
        this.reloadLevel();

        this.invisibleLadder = [];
        this.grabedItems = this.getValue();
    }

    isInside(x, y)
    {
        return (x >= 0 && x < WORLD_WIDTH && y >= 0 && y < WORLD_HEIGHT)
    }

    get(x, y)
    {
        let aux = this.getBehind(x, y);
        if (aux !== this.boundaryStone && control.gameState.worldActive[x][y] !== empty)
        {
            return control.gameState.worldActive[x][y];
        }
        else
            return aux;
    }

    // return the number of items (gold) on the world and store invisible ladder positions
    getValue()
    {
        control.gameState.invisibleLadder = [];
        let value = 0;
        for (let i = 0; i < WORLD_WIDTH; i++)
        {
            for (let j = 0; j < WORLD_HEIGHT; j++)
            {
                if (control.gameState.world[i][j].isItem())
                    value++;
                if (!control.gameState.world[i][j].isVisible())
                    this.storeCoordinates(i, j, control.gameState.invisibleLadder);
            }
        }
        return value;
    }

    storeCoordinates(xVal, yVal, array)
    {
        array.push(
        {
            x: xVal,
            y: yVal
        }
        );
    }

    makeLadderVisible()
    {
        let array = control.gameState.invisibleLadder;
        for (let i = 0; i < array.length; i++)
        {
            control.gameState.world[array[i].x][array[i].y].makeVisible();
        }
    }

    getBehind(x, y)
    {
        if (!this.isInside(x, y))
            return this.boundaryStone;

        return control.gameState.world[x][y];
    }

    loadNextLevel()
    {
        let gs = control.gameState;
        if (gs.currentLevel < MAPS.length)
        {
            control.clearCanvas();
            gs.currentLevel++;
            gs.loadLevel(control.gameState.currentLevel);
        }
    }

    loadPreviousLevel()
    {
        let gs = control.gameState;

        if (gs.currentLevel > 1)
        {
            control.clearCanvas();
            gs.currentLevel--;
            gs.loadLevel(control.gameState.currentLevel);
        }
    }

    reloadLevel()
    {
        control.clearCanvas();
        control.gameState.loadLevel(control.gameState.currentLevel);
    }

    load()
    {
        addEventListener("keydown", this.keyDownEvent, false);
        addEventListener("keyup", this.keyUpEvent, false);

        this.interval = setInterval(this.animationEvent, 1000 / ANIMATION_EVENTS_PER_SECOND);

        // HTML stuff
        document.getElementById("nextLevelBtn").addEventListener("click", 
            this.loadNextLevel, false);
        document.getElementById("prevLevelBtn").addEventListener("click", 
            this.loadPreviousLevel, false);
        document.getElementById("reloadLevelBtn").addEventListener("click", 
            this.reloadLevel, false);

        document.getElementById("nextLevelBtn").style.display = "block";
        document.getElementById("prevLevelBtn").style.display = "block";
        document.getElementById("reloadLevelBtn").style.display = "block";
    }

    unload()
    {
        removeEventListener("keydown", this.keyDownEvent, false);
        removeEventListener("keyup", this.keyUpEvent, false);
        clearInterval(this.interval);

        // HTML stuff
        document.getElementById("nextLevelBtn").removeEventListener("click", 
            this.loadNextLevel, false);
        document.getElementById("nextLevelBtn").removeEventListener("click", 
            this.loadPreviousLevel, false);
        document.getElementById("reloadLevelBtn").removeEventListener("click", 
            this.reloadLevel, false);

        document.getElementById("nextLevelBtn").style.display = "none";
        document.getElementById("prevLevelBtn").style.display = "none";
        document.getElementById("reloadLevelBtn").style.display = "none";
    }

    onSwitch(otherState)
    {
        this.onCreate();
    }

    // stored by columns
    createMatrix()
    {
        let matrix = new Array(WORLD_WIDTH);
        for (let x = 0; x < WORLD_WIDTH; x++)
        {
            let a = new Array(WORLD_HEIGHT);
            for (let y = 0; y < WORLD_HEIGHT; y++)
                a[y] = empty;
            matrix[x] = a;
        }
        return matrix;
    }

    loadLevel(level)
    {
        this.world = this.createMatrix();
        this.worldActive = this.createMatrix();

        if (level < 1 || level > MAPS.length)
            fatalError("Invalid level " + level)
            let map = MAPS[level - 1]; // -1 because levels start at 1
        for (let x = 0; x < WORLD_WIDTH; x++)
            for (let y = 0; y < WORLD_HEIGHT; y++)
            {
                // x/y reversed because map stored by lines
                GameFactory.actorFromCode(map[y][x], x, y);
            }
        this.grabedItems = this.getValue();
    }

    getKey()
    {
        let k = control.gameState.key;
        control.gameState.key = 0;
        switch (k)
        {
        case 37:
        case 79:
        case 74:
            return [-1, 0]; //  LEFT, O, J
        case 38:
        case 81:
        case 73:
            return [0, -1]; //    UP, Q, I
        case 39:
        case 80:
        case 76:
            return [1, 0]; // RIGHT, P, L
        case 40:
        case 65:
        case 75:
            return [0, 1]; //  DOWN, A, K
        case 32:
            return " ";
        default:
            return null;
        };
    }

    // animate both active and passive world
    animationEvent()
    {
        let gs = control.gameState;

        gs.time++;
        for (let x = 0; x < WORLD_WIDTH; x++)
            for (let y = 0; y < WORLD_HEIGHT; y++)
            {
                let a = gs.worldActive[x][y];
                let b = gs.world[x][y];

                if (a.time < gs.time)
                {
                    a.time = gs.time;
                    a.animation();
                }
                if (b.time < gs.time)
                {
                    b.time = gs.time;
                    b.animation();
                }
            }
    }

    keyDownEvent(k)
    {
        control.gameState.key = k.keyCode;
    }

    keyUpEvent(k) {}
}

class MainMenuState extends State
{
    constructor()
    {
        super();
    }

    onCreate()
    {
        control.clearCanvas();
        this.showMainMenu();
    }

    onSwitch(oldState)
    {
        this.onCreate();
    }

    load()
    {
        document.getElementById("startBtn").addEventListener("click", 
            this.initializeGame, false);
        document.getElementById("optionsBtn").addEventListener("click", 
            this.showOptions, false);
        document.getElementById("backBtn").addEventListener("click", 
            this.showMainMenu, false);
        document.getElementById("sliderSize").addEventListener("change", 
            this.changeScale, false);
    }

    unload()
    {
        control.mainMenuState.hide();
        document.getElementById("backBtn").style.display = 'none';
        document.getElementById("sliderSize").style.display = 'none';
    }

    hide()
    {
        document.getElementById("startBtn").style.display = 'none';
        document.getElementById("optionsBtn").style.display = 'none';
    }

    changeScale(){
        let val = document.getElementById("sliderSize").value;
        scaleCanvas(val, val);
    }

    initializeGame()
    {
        control.statesMachine.changeState("Game");
    }

    showOptions()
    {
        control.mainMenuState.hide();
        document.getElementById("backBtn").style.display = 'block';
        document.getElementById("sliderSize").style.display = 'block';
    }

    showMainMenu()
    {
        document.getElementById("startBtn").style.display = 'block';
        document.getElementById("optionsBtn").style.display = 'block';
        document.getElementById("backBtn").style.display = 'none';
        document.getElementById("sliderSize").style.display = 'none';
    }
}

class GameOverState extends State
{
    constructor()
    {
        super();
        this.hide();
    }

    onCreate()
    {
        this.showGameOver();
    }

    onSwitch(oldState)
    {
        this.onCreate();
    }

    load()
    {
        document.getElementById("restartLvlBtn").addEventListener("click", 
            this.restartLevel, false);
        document.getElementById("restartGameBtn").addEventListener("click", 
            this.restartGame, false);
        document.getElementById("mainMenuBtn").addEventListener("click", 
            this.gotoMainMenu, false);
    }

    unload()
    {
        control.gameOverState.hide();
    }

    gotoMainMenu()
    {
        control.statesMachine.changeState("MainMenu");
    }

    restartLevel()
    {
        let lvl = control.gameState.currentLevel;

        control.statesMachine.changeState("Game");

        control.clearCanvas();
        control.gameState.loadLevel(lvl);
    }

    restartGame()
    {
        control.statesMachine.changeState("Game");
    }

    hide()
    {
        document.getElementById("restartLvlBtn").style.display = 'none';
        document.getElementById("restartGameBtn").style.display = 'none';
        document.getElementById("mainMenuBtn").style.display = 'none';
    }

    showGameOver()
    {
        document.getElementById("restartLvlBtn").style.display = 'block';
        document.getElementById("restartGameBtn").style.display = 'block';
        document.getElementById("mainMenuBtn").style.display = 'block';
    }
}
