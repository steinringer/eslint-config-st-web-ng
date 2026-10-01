[Route("api/test/[controller]/[action]")]
public class PrimitiveController {
    public object Save([FromBody] int value) => value;
}
