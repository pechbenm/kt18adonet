namespace KT18.Charts.Models;

/// <summary>Одна точка графика: подпись по оси X и значение продаж.</summary>
public sealed record SalesPoint(string Label, decimal Value);

public enum SalesChartType
{
    Bar,
    Line
}
